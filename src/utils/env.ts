/**
 * Utility to get environment variables across different environments (Astro, Jest, etc.)
 */
export const getEnv = (key: string): string => {
	// 1. Try process.env (Jest/Node/Vercel Runtime)
	// This is the most reliable way in Node-based environments
	if (typeof process !== 'undefined' && process.env && process.env[key]) {
		return process.env[key];
	}

	// 2. Try Astro/Vite import.meta.env (Astro's preferred way for client/build)
	try {
		// We use a safe check to avoid SyntaxErrors in environments that don't support import.meta
		// during parsing/transpilation (like some Jest configurations)
		const getMetadata = new Function('return import.meta.env');
		const env = getMetadata();
		if (env && env[key]) {
			return env[key];
		}
	} catch {
		// Fallback for environments where import.meta is not supported
	}

	return '';
};
