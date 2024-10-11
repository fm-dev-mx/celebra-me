// src/utilities/getClientIp.ts

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
		// 'x-forwarded-for' can be a comma-separated list of IPs
		const ips = forwardedFor.split(',').map(ip => ip.trim());
		return ips[0]; // Return the first IP in the list
	}

	// Fallback to 'x-real-ip' if available
	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// In development mode, use a fixed key to enable consistent rate limiting
	if (import.meta.env.DEV) {
		console.warn('Development mode: using fixed key for rate limiting.');
		return 'development-key';
	}

	// In production, throw an error or handle as per your application's requirements
	throw new Error('Unable to determine client IP address.');
}
