/**
 * Environment reader safe to import from shared modules.
 * Vercel and Astro SSR expose runtime values through process.env. No
 * filesystem or Node-only imports belong here because this helper can be
 * reached while Vite assembles browser-safe route code.
 */
export const getEnv = (key: string): string => {
	if (process.env[key]) return process.env[key] as string;
	return '';
};
