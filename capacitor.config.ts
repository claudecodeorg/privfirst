import type { CapacitorConfig } from '@capacitor/cli';

// applicationId is permanent once published to Google Play — do not change after release.
// Chosen as the reverse-DNS of app.runhatlabs.in, a domain the developer owns.
const config: CapacitorConfig = {
  appId: 'in.runhatlabs.app',
  appName: 'PrivFirst',
  webDir: 'dist',
  // https (not the default capacitor:// scheme) so the CSP's 'self' and Digital Asset Links /
  // Play Billing's origin checks all line up with a real https origin.
  server: {
    androidScheme: 'https',
  },
};

export default config;
