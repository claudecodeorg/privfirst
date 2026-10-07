// Thin typed wrappers for the three hand-written Kotlin Capacitor plugins that live under
// android/app/src/main/java/in/runhatlabs/app/ (not npm packages, so there's no vendor-supplied
// JS binding — registerPlugin() is how Capacitor wires any native plugin into the JS bridge).
// Only ever called when Capacitor.isNativePlatform() is true; calling them on web throws.
import { registerPlugin } from '@capacitor/core';

export interface SaveFileResult {
  saved: boolean;
  shared?: boolean;
}
interface SaveFilePlugin {
  save(options: { sourcePath: string; name: string; mimeType: string }): Promise<SaveFileResult>;
}

interface PermReleasePlugin {
  releaseCamera(): Promise<void>;
}

export type PurchaseStatus = 'purchased' | 'pending' | 'canceled' | 'already_owned' | 'unavailable' | 'error';
export interface ProductDetailsResult {
  found: boolean;
  formattedPrice?: string;
  priceAmountMicros?: string;
  currencyCode?: string;
}
export interface PurchaseResult {
  status: PurchaseStatus;
  message?: string;
}
export interface QueryPurchasesResult {
  owned: boolean;
  status?: string;
  message?: string;
}
interface PlayBillingPlugin {
  queryProductDetails(options: { productId: string }): Promise<ProductDetailsResult>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  queryPurchases(): Promise<QueryPurchasesResult>;
}

export const SaveFile = registerPlugin<SaveFilePlugin>('SaveFile');
export const PermRelease = registerPlugin<PermReleasePlugin>('PermRelease');
export const PlayBilling = registerPlugin<PlayBillingPlugin>('PlayBilling');
