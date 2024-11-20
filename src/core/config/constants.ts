// src/core/config/constants.ts

/**
 * Helper function to create a JSON response.
 */
export const jsonResponse = <T>(data: T, status = 200): Response => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const jsonPost = (data: unknown) => ({
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	},
	body: JSON.stringify(data),
});

export const ASSET_PREFIX = '/';
