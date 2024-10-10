// src/utilities/getClientIp.ts
import validator from 'validator';
import { randomUUID } from 'crypto';

/**
 * Retrieves the client's IP address from the request headers.
 * Validates the IP format to ensure it's a valid IP.
 * If no valid IP is found, returns a unique identifier or a fixed key in development.
 * @param request - The incoming HTTP request.
 * @returns {string} - The client's IP address or a unique identifier if not found.
 */
export function getClientIP(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		// x-forwarded-for may return multiple IP addresses in the format: "client, proxy1, proxy2"
		const forwardedIps = forwarded.split(',').map(ip => ip.trim());
		const clientIp = forwardedIps.find(
			ip => validator.isIP(ip, 4) || validator.isIP(ip, 6)
		); // Find the first valid IP
		if (clientIp) {
			return clientIp;
		}
	}

	const realIP = request.headers.get('x-real-ip');
	if (realIP && (validator.isIP(realIP, 4) || validator.isIP(realIP, 6))) {
		return realIP;
	}

	// Return a fixed key in development to enable rate limiting
	if (import.meta.env.DEV) {
		console.warn('Development mode: using fixed key for rate limiting.');
		return 'development-key';
	}

	// Generate a unique identifier if no valid IP is found in production
	const uniqueKey = randomUUID();
	console.warn(`No valid IP found; using unique key: ${uniqueKey}`);
	return uniqueKey;
}
