// src/backend/utilities/getClientIp.ts

import type { Request } from 'express';

/**
 * Retrieves the client's IP address from the request, respecting 'trust proxy' settings.
 *
 * @param req - The Express request object.
 * @returns {string | undefined} - The client's IP address, or undefined if not determinable.
 *
 * @example
 * app.set('trust proxy', true);
 * const clientIp = getClientIp(req);
 */
export function getClientIp(req: Request): string | undefined {
	// Express populates req.ip when 'trust proxy' is enabled
	const ip = req.ip;

	if (!ip) {
		// Return undefined if IP is not available
		return undefined;
	}

	// Normalize IP address format (remove common IPv6 prefixes)
	if (ip.startsWith('::ffff:')) {
		return ip.substring(7);
	} else if (ip === '::1') {
		return '127.0.0.1';
	}

	return ip;
}
