package `in`.runhatlabs.app

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Minimal wrapper around the official Play Billing Library for the single one-time
 * "lifetime_access" product. No third-party SDK, no backend: entitlement is whatever Play
 * reports, cached client-side in JS (src/lib/billing.ts) so it still works offline after
 * purchase. There is deliberately no server-side receipt verification — see
 * docs/android-publishing.md for why, and the implication of that choice.
 */
@CapacitorPlugin(name = "PlayBilling")
class PlayBillingPlugin : Plugin(), PurchasesUpdatedListener {
    private lateinit var billingClient: BillingClient
    private var connected = false
    private var reconnectAttempt = 0
    private var pendingPurchaseCall: PluginCall? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun load() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
    }

    private fun ensureConnected(onReady: (ok: Boolean, message: String?) -> Unit) {
        if (connected) {
            onReady(true, null)
            return
        }
        val listener = object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    connected = true
                    reconnectAttempt = 0
                    onReady(true, null)
                } else {
                    onReady(false, result.debugMessage)
                }
            }

            override fun onBillingServiceDisconnected() {
                connected = false
                // Capped exponential backoff, per Play's own reconnection guidance.
                reconnectAttempt = (reconnectAttempt + 1).coerceAtMost(6)
                val delayMs = (1000L shl reconnectAttempt).coerceAtMost(60_000L)
                mainHandler.postDelayed({ billingClient.startConnection(this) }, delayMs)
            }
        }
        billingClient.startConnection(listener)
    }

    @PluginMethod
    fun queryProductDetails(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId == null) {
            call.reject("productId required")
            return
        }
        ensureConnected { ok, message ->
            if (!ok) {
                resolveUnavailable(call, message)
                return@ensureConnected
            }
            val product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
            val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()
            billingClient.queryProductDetailsAsync(params) { result, productDetailsResult ->
                val details = productDetailsResult.productDetailsList.firstOrNull()
                if (result.responseCode != BillingClient.BillingResponseCode.OK || details == null) {
                    val ret = JSObject()
                    ret.put("found", false)
                    call.resolve(ret)
                    return@queryProductDetailsAsync
                }
                val offer = details.oneTimePurchaseOfferDetails
                val ret = JSObject()
                ret.put("found", true)
                ret.put("formattedPrice", offer?.formattedPrice ?: "")
                ret.put("priceAmountMicros", (offer?.priceAmountMicros ?: 0L).toString())
                ret.put("currencyCode", offer?.priceCurrencyCode ?: "")
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId == null) {
            call.reject("productId required")
            return
        }
        val currentActivity = activity
        if (currentActivity == null) {
            call.reject("No activity")
            return
        }
        ensureConnected { ok, message ->
            if (!ok) {
                resolveUnavailable(call, message)
                return@ensureConnected
            }
            val product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
            val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()
            billingClient.queryProductDetailsAsync(params) { result, productDetailsResult ->
                val details = productDetailsResult.productDetailsList.firstOrNull()
                if (result.responseCode != BillingClient.BillingResponseCode.OK || details == null) {
                    resolveUnavailable(call, result.debugMessage)
                    return@queryProductDetailsAsync
                }
                val flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(
                        listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build())
                    )
                    .build()
                pendingPurchaseCall = call
                val launchResult = billingClient.launchBillingFlow(currentActivity, flowParams)
                if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchaseCall = null
                    val ret = JSObject()
                    ret.put("status", "error")
                    ret.put("message", launchResult.debugMessage)
                    call.resolve(ret)
                }
                // On success the result arrives asynchronously via onPurchasesUpdated below.
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val call = pendingPurchaseCall
        pendingPurchaseCall = null
        val ret = JSObject()
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val purchase = purchases?.firstOrNull()
                if (purchase != null) {
                    acknowledgeIfNeeded(purchase)
                    ret.put("status", statusFor(purchase))
                } else {
                    ret.put("status", "error")
                    ret.put("message", "No purchase returned")
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> ret.put("status", "canceled")
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> ret.put("status", "already_owned")
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> {
                ret.put("status", "unavailable")
                ret.put("message", result.debugMessage)
            }
            else -> {
                ret.put("status", "error")
                ret.put("message", result.debugMessage)
            }
        }
        call?.resolve(ret)
    }

    private fun statusFor(purchase: Purchase): String = when (purchase.purchaseState) {
        Purchase.PurchaseState.PURCHASED -> "purchased"
        Purchase.PurchaseState.PENDING -> "pending"
        else -> "error"
    }

    private fun acknowledgeIfNeeded(purchase: Purchase) {
        // Must acknowledge within 3 days of purchase or Play auto-refunds it.
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged) {
            val ackParams = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
            billingClient.acknowledgePurchase(ackParams) {
                // Best-effort: if this silently fails, the next queryPurchases() call retries it.
            }
        }
    }

    @PluginMethod
    fun queryPurchases(call: PluginCall) {
        ensureConnected { ok, message ->
            if (!ok) {
                resolveUnavailable(call, message)
                return@ensureConnected
            }
            val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
            billingClient.queryPurchasesAsync(params) { result, purchases ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    resolveUnavailable(call, result.debugMessage)
                    return@queryPurchasesAsync
                }
                val owned = purchases.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                purchases.forEach { if (it.purchaseState == Purchase.PurchaseState.PURCHASED) acknowledgeIfNeeded(it) }
                val ret = JSObject()
                ret.put("owned", owned)
                call.resolve(ret)
            }
        }
    }

    private fun resolveUnavailable(call: PluginCall, message: String?) {
        val ret = JSObject()
        ret.put("status", "unavailable")
        ret.put("owned", false)
        ret.put("message", message ?: "Billing unavailable")
        call.resolve(ret)
    }
}
