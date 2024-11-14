// src/core/config/constants.ts

import { ContactFormData } from "../interfaces/contactFormData.interface";

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

export const jsonPost = (data: ContactFormData) => ({
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
	},
	body: JSON.stringify(data),
});

export const ASSET_PREFIX = "/";
