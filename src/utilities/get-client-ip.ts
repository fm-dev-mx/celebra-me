// src/utilities/get-client-ip.ts
import validator from 'validator';

/**
 * Retrieves the client's IP address from the request headers.
 * Validates the IP format to ensure it's a valid IP.
 * If no valid IP is found, returns '127.0.0.1' in local development for testing purposes.
 * @param request - The incoming HTTP request.
 * @returns {string} - The client's IP address or '127.0.0.1' if not found or invalid in local.
 */
export function getClientIP(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		// x-forwarded-for may return multiple IP addresses in the format: "client, proxy1, proxy2"
		const forwardedIps = forwarded.split(',').map(ip => ip.trim());
		const clientIp = forwardedIps.find(ip => validator.isIP(ip)); // Find the first valid IP
		if (clientIp) {
			return clientIp;
		}
	}

	const realIP = request.headers.get('x-real-ip');
	if (realIP && validator.isIP(realIP)) {
		return realIP;
	}

	// Fallback to local IP for development environment
	if (process.env.NODE_ENV === 'development') {
		console.warn(
			'No valid IP found in x-forwarded-for or x-real-ip headers, using local IP 127.0.0.1'
		);
		return '127.0.0.1'; // Use default local IP for development
	}

	// If no valid IP is found in production
	console.warn('No valid IP found in x-forwarded-for or x-real-ip headers');
	return 'unknown';
}
