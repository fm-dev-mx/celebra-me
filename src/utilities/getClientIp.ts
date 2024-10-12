// src/utilities/getClientIp.ts

import logger from '@/utilities/logger';
import { ENVIRONMENT } from '@/config';

/**
 * Retrieves the client's IP address from the request headers.
 * If no valid IP is found, returns a fixed key in development or throws an error in production.
 *
 * @param request - The incoming Fetch API request from Astro.
 * @returns {string} - The client's IP address or a fixed key if not found in development.
 */
export function getClientIp(request: Request): string {
	// Try to extract the IP from the 'x-forwarded-for' header
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		const ips = forwardedFor.split(',').map((ip) => ip.trim());
		return ips[0];
	}

	// Fallback to 'x-real-ip' if available
	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// In development mode, use a fixed key
	if (ENVIRONMENT === 'development') {
		logger.warn('Development mode: using fixed key for rate limiting.');
		return 'development-key';
	}

	// In production, log the error and throw
	logger.error('Unable to determine client IP address.');
	throw new Error('Unable to determine client IP address.');
}
