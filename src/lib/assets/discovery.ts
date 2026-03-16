/**
 * Discovery helper for assets.
 * Separated to allow mocking in test environments.
 */

export function discoverEventModules() {
	// Vite-specific dynamic discovery
	// This will be replaced by Vite during build/dev
	// In Jest, we will mock this file.
	return import.meta.glob('../../assets/images/events/*/index.ts', {
		import: 'assets',
		eager: true,
	});
}
