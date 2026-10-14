/**
 * Environment resolver for tracking modules.
 * Isolates import.meta.env references to prevent syntax errors in Jest CJS runtime.
 */

export function getGaMeasurementId(): string {
	return import.meta.env.PUBLIC_GA_MEASUREMENT_ID || '';
}
