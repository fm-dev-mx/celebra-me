// src/frontend/utilities/apiClientUtils.ts

/**
 * Helper function to create options for a JSON POST request.
 *
 * @param data - The data to include in the request body.
 * @returns An object containing method, headers, and body for a fetch request.
 */
export function jsonPost(data: unknown): RequestInit {
	return {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify(data),
	};
}
