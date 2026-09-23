const VISUAL_PATH_PATTERNS = [
	/^src\/(?:components|layouts|pages)\/.*\.(?:astro|tsx)$/u,
	/^src\/styles\//u,
	/^src\/content\//u,
	/^src\/assets\//u,
	/^public\/.*\.(?:avif|gif|jpe?g|png|svg|webp|woff2?)$/u,
	/^scripts\/(?:playwright|screenshot)\//u,
	/^tests\/(?:e2e|fixtures)\//u,
	/^(?:astro|playwright)\.config\./u,
];

export function normalizeVisualPath(path: string): string {
	return path.replaceAll('\\', '/');
}

export function isVisualImpactPath(path: string): boolean {
	const normalized = normalizeVisualPath(path);
	return VISUAL_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function visualImpactFiles(paths: string[]): string[] {
	return [...new Set(paths.map(normalizeVisualPath))].filter(isVisualImpactPath).sort();
}
