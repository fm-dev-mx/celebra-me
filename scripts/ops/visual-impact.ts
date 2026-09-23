const VISUAL_PATH_PATTERNS = [
	/^src\/.*\.(?:astro|css|json|scss|ts|tsx|ya?ml)$/u,
	/^src\/content\//u,
	/^src\/assets\//u,
	/^public\/.*\.(?:avif|gif|jpe?g|otf|png|svg|ttf|webp|woff2?)$/u,
	/^scripts\/provision\/invitations\/.*\.ts$/u,
	/^scripts\/provision\/local-render-corpus\//u,
	/^scripts\/(?:playwright|screenshot)\//u,
	/^tests\/(?:e2e|fixtures)\//u,
	/^(?:astro|playwright(?:\.[^.]+)?)\.config\./u,
	/^(?:package\.json|pnpm-lock\.yaml)$/u,
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
