/**
 * Discovery helper for assets.
 * Separated to allow mocking in test environments.
 */

export function discoverEventModules() {
	// Vite-specific dynamic discovery
	// This will be replaced by Vite during build/dev
	// In Jest, we will mock this file.
	// Both paths end in `<slug>/<file>.ts`, so the parent folder names the event.
	return import.meta.glob(
		['../../assets/images/events/*/index.ts', '../../invitations/demos/*/assets.ts'],
		{
			import: 'assets',
			eager: true,
		},
	);
}
