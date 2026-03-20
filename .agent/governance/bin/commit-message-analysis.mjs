import { basename } from 'path';

function normalizePath(value) {
	return String(value || '')
		.replace(/\\/g, '/')
		.trim();
}

function stemOf(file) {
	const name = (normalizePath(file).split('/').pop() || file).replace(/\.[^.]+$/, '');
	return name
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function classifyCommitFileArea(file) {
	const normalized = normalizePath(file).toLowerCase();
	if (!normalized) return 'source';
	if (normalized.startsWith('.agent/plans/')) return 'plan';
	if (normalized.startsWith('src/styles/') || /\.(scss|css)$/i.test(normalized)) return 'style';
	if (
		normalized.startsWith('docs/') ||
		normalized.endsWith('.md') ||
		normalized.endsWith('.mdx')
	) {
		return 'docs';
	}
	if (
		normalized.startsWith('tests/') ||
		normalized.includes('.test.') ||
		normalized.includes('.spec.')
	) {
		return 'test';
	}
	if (
		normalized.startsWith('src/assets/') ||
		/\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(normalized)
	) {
		return 'asset';
	}
	if (
		normalized.startsWith('scripts/') ||
		normalized.startsWith('.agent/') ||
		normalized.endsWith('.mjs') ||
		normalized.endsWith('.sh')
	) {
		return 'script';
	}
	if (
		normalized.endsWith('.json') ||
		normalized.endsWith('.yml') ||
		normalized.endsWith('.yaml') ||
		normalized.endsWith('.toml') ||
		normalized.endsWith('.ini') ||
		normalized.endsWith('.cjs')
	) {
		return 'config';
	}
	return 'source';
}

function collectFileFacts(files, diffEntries = []) {
	const diffByPath = new Map(
		(diffEntries || []).map((entry) => [normalizePath(entry.path), entry]),
	);
	return (files || []).map((file) => {
		const normalizedPath = normalizePath(file);
		const diffEntry = diffByPath.get(normalizedPath) || {};
		return {
			path: normalizedPath,
			oldPath: normalizePath(diffEntry.oldPath || ''),
			status: String(diffEntry.status || 'M').toUpperCase(),
			area: diffEntry.area || classifyCommitFileArea(normalizedPath),
			additions: Number(diffEntry.additions || 0),
			deletions: Number(diffEntry.deletions || 0),
			stem: stemOf(normalizedPath).toLowerCase(),
			basename: basename(normalizedPath),
		};
	});
}

export { classifyCommitFileArea, collectFileFacts, normalizePath };
