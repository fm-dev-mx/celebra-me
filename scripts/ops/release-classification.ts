import { execFileSync } from 'node:child_process';

export type ReleaseCategory =
	'tooling-only' | 'application' | 'schema-dependent' | 'invitation-content';
export interface ReleaseClassification {
	baseSha: string;
	headSha: string;
	files: Array<{ path: string; category: ReleaseCategory }>;
	category: ReleaseCategory;
	reasons: string[];
	applicableGates: string[];
}

export function classifyReleaseFiles(
	paths: string[],
	baseSha: string,
	headSha: string,
): ReleaseClassification {
	const classify = (path: string): ReleaseCategory => {
		if (
			/^supabase\/(migrations\/|migration-rollout-registry\.json$|deployed-app-capabilities\.json$)/u.test(
				path,
			)
		)
			return 'schema-dependent';
		if (
			/^(scripts\/provision\/invitations\/|docs\/invitations\/|src\/assets\/invitations\/|src\/styles\/invitation-profiles\/)/u.test(
				path,
			)
		)
			return 'invitation-content';
		if (
			/^(scripts\/|tests\/|docs\/|\.agent\/)/u.test(path) ||
			/^(README|CHANGELOG).*\.md$/u.test(path)
		)
			return 'tooling-only';
		return 'application';
	};
	const files = paths.filter(Boolean).map((path) => ({ path, category: classify(path) }));
	const categories = new Set(files.map((file) => file.category));
	let category: ReleaseCategory;
	if (categories.has('schema-dependent')) category = 'schema-dependent';
	else if (categories.has('application') || categories.size > 1) category = 'application';
	else category = files[0]?.category ?? 'application';
	const applicableGates = ['Repository Policy', 'Application Suite', 'Preview smoke'];
	if (category === 'schema-dependent')
		applicableGates.push(
			'capability manifest',
			'exact Production deployment and smoke',
			'owner apply and backup',
		);
	if (category === 'invitation-content')
		applicableGates.push(
			'lifecycle',
			'Preview approval bound to hashes',
			'owner-only Production publication',
		);
	return {
		baseSha,
		headSha,
		files,
		category,
		reasons:
			category === 'tooling-only'
				? [
						'Only allowlisted tooling, test, agent, or documentation paths changed.',
						'No schema migration, Production database apply, or backup is indicated by this classification.',
					]
				: [
						`Effective category is ${category}; unknown paths and mixed categories escalate conservatively.`,
					],
		applicableGates,
	};
}

export function classifyReleaseRange(baseSha: string, headSha: string): ReleaseClassification {
	for (const sha of [baseSha, headSha]) {
		if (!/^[a-f0-9]{40}$/iu.test(sha))
			throw new Error('Both base and head must be exact 40-character SHAs.');
	}
	for (const sha of [baseSha, headSha])
		execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`]);
	const paths = execFileSync('git', ['diff', '--name-only', baseSha, headSha], {
		encoding: 'utf8',
	})
		.trim()
		.split(/\r?\n/u);
	return classifyReleaseFiles(paths, baseSha, headSha);
}
