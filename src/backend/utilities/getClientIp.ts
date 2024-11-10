// src/backend/utilities/getClientIp.ts

/**
 * Retrieves the client's IP address from the Astro request object.
 * In development mode, returns '127.0.0.1' as a fallback if no IP is detected.
 *
 * @param req - The Fetch API Request object.
 * @returns {string | null} - The client's IP address, or '127.0.0.1' in development if not determinable.
 */
export function getClientIp(req: Request): string | null {
	// Attempt to retrieve the IP from the 'x-forwarded-for' header, which is standard in proxy setups
	const xForwardedFor = req.headers.get('x-forwarded-for');
	if (xForwardedFor) {
		// 'x-forwarded-for' can contain multiple IPs; the first one is the client's IP
		const ip = xForwardedFor.split(',')[0].trim();
		return ip;
	}

	// Fallback: Check for 'cf-connecting-ip' header if using Cloudflare
	const cfConnectingIp = req.headers.get('cf-connecting-ip');
	if (cfConnectingIp) {
		return cfConnectingIp;
	}

	// Fallback: Check for 'x-real-ip' header, if using a reverse proxy
	const xRealIp = req.headers.get('x-real-ip');
	if (xRealIp) {
		return xRealIp;
	}

	// In development mode, return '127.0.0.1' as a default IP
	if (process.env.NODE_ENV === 'development') {
		return '127.0.0.1';
	}

	// No IP found in headers
	return null;
}
