// src/utilities/getClientIp.ts

import logger from '@/backend/utilities/logger';
import config from '@/core/config';

/**
 * Retrieves the client's IP address from the request headers.
 * If no valid IP is found, returns null and allows the caller to handle it.
 *
 * @param request - The incoming Fetch API request from Astro.
 * @returns {string | null} - The client's IP address or null if not found.
 */
export function getClientIp(request: Request): string | null {
	// Try to extract the IP from the 'x-forwarded-for' header
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		const ips = forwardedFor.split(',').map((ip) => ip.trim());
		return ips[0];
	}

	// Try to extract the IP from the 'forwarded' header
	const forwarded = request.headers.get('forwarded');
	if (forwarded) {
		const match = forwarded.match(/for="\[?(.*?)\]?"/);
		if (match) {
			return match[1];
		}
	}

	// Fallback to 'x-real-ip' if available
	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// In development mode, use a fixed key
	if (config.ENVIRONMENT === 'development') {
		logger.warn('Development mode: using fixed key for rate limiting.');
		return 'development-key';
	}

	// In production, log a warning and return null
	logger.warn('Unable to determine client IP address.');
	return null;
}
