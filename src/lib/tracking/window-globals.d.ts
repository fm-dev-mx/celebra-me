/**
 * Shared Window interface augmentation for tracking modules.
 * Canonical source for dataLayer and gtag type declarations —
 * prevents divergence between client.ts and ga4-forwarder.ts.
 */
declare global {
	interface Window {
		dataLayer?: Array<Record<string, unknown> | IArguments>;
		gtag?: (...args: unknown[]) => void;
	}
}

export {};
