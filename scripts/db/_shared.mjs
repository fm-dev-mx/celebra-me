export function isLocalSupabaseUrl(url) {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return ['localhost', '127.0.0.1', '::1'].includes(host);
	} catch {
		return false;
	}
}
