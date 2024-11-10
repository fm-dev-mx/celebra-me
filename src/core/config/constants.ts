// src/core/config/constants.ts

/**
 * Prefix for asset paths.
 */

/**
 * Helper function to create a JSON response.
 */
export const jsonResponse = (data: Record<string, unknown>, status = 200): Response => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const ASSET_PREFIX = "/";
