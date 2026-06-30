/**
 * Thin adapter for environment variables consumed by the Meta Pixel module.
 *
 * Extracted into its own module so tests can mock env values without
 * triggering the `import.meta` parse error in Jest's CJS runtime.
 */
export function getPixelIdFromEnv(): string {
	return import.meta.env.PUBLIC_META_PIXEL_ID?.trim() || '';
}

export function isPixelEnabledInEnv(): boolean {
	return import.meta.env.PUBLIC_META_PIXEL_ENABLED === 'true';
}
