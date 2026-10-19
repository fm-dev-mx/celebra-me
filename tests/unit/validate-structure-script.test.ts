import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'validate-structure.mjs');
const SCRIPT_URL = pathToFileURL(SCRIPT_PATH).href;
const RETIRED_PROVIDER_URL = pathToFileURL(
	path.join(ROOT, 'scripts', 'validate-retired-provider-references.mjs'),
).href;

function writeFixtureFile(root: string, file: string, content: string) {
	const target = path.join(root, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content, 'utf8');
}

function createFixture(skillDomain = 'quality') {
	const root = mkdtempSync(path.join(tmpdir(), 'validate-structure-'));
	writeFixtureFile(root, 'AGENTS.md', '# Agent guide\n');
	writeFixtureFile(
		root,
		'.agent/index.md',
		[
			'# Index',
			'- [`Agent guide`](../AGENTS.md)',
			'## Available Skills',
			'| Skill | Purpose |',
			'| --- | --- |',
			'| `testing` | tests |',
			'## Workflows',
		].join('\n'),
	);
	writeFixtureFile(
		root,
		'.agent/skills/testing/SKILL.md',
		[
			'---',
			'name: testing',
			'description: Test guidance',
			`domain: ${skillDomain}`,
			'version: 1.0.0',
			'when_to_use:',
			'  - Testing changes',
			'preconditions:',
			'  - Read AGENTS.md',
			'related_skills: []',
			'related_docs:',
			'  - AGENTS.md',
			'---',
			'# Testing',
		].join('\n'),
	);
	writeFixtureFile(
		root,
		'.agent/agents/builder.yaml',
		[
			'---',
			'name: builder',
			'role: implementation',
			'version: 1.0.0',
			'status: active',
			'purpose: Build the requested change',
			'responsibilities:',
			'  - Implement scoped changes',
			'required_capabilities:',
			'  - repository-read',
			'restricted_capabilities:',
			'  - git-write',
			'skills:',
			'  - testing',
			'constraints:',
			'  - Stay within scope',
		].join('\n'),
	);
	writeFixtureFile(
		root,
		'.agent/ownership.yaml',
		[
			'- aspect: "Task Contract, Goal protocol & Handoff Contract"',
			'  owner: ".agent/plans/README.md"',
			'- aspect: "Plans lifecycle & tracked plan governance"',
			'  owner: ".agent/plans/README.md"',
			'- aspect: "Git authorization & worktree safety"',
			'  owner: ".agent/rules/git-safety.md"',
			'- aspect: "testing"',
			'  owner: "AGENTS.md"',
		].join('\n'),
	);
	writeFixtureFile(root, '.agent/plans/README.md', '# Plans\n');
	writeFixtureFile(root, '.agent/rules/git-safety.md', '# Git safety\n');
	writeFixtureFile(root, '.agent/rules/gatekeeper.md', '# Gatekeeper\n');
	writeFixtureFile(
		root,
		'.agent/routing-matrix.yaml',
		[
			'bootstrap:',
			'  rules:',
			'    - ".agent/rules/gatekeeper.md"',
			'    - ".agent/rules/git-safety.md"',
			'routes:',
			'  - task_type: "testing"',
			'    skills:',
			'      - "testing"',
		].join('\n'),
	);
	writeFixtureFile(
		root,
		'.agent/plans/active/current.md',
		['---', 'title: Current', 'status: active', '---', '# Current'].join('\n'),
	);
	return root;
}

function validateFixture(root: string, trackedFiles: string[] = []) {
	const script = `
		import { validateStructure } from ${JSON.stringify(SCRIPT_URL)};
		const errors = validateStructure({
			root: ${JSON.stringify(root)},
			trackedFiles: ${JSON.stringify(trackedFiles)},
		});
		process.stdout.write(JSON.stringify(errors));
	`;
	const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: ROOT,
	});
	return JSON.parse(result.stdout) as string[];
}

describe('validate-structure script', () => {
	it.each(['quality', 'workflow'])('accepts the %s skill domain', (skillDomain) => {
		const fixtureRoot = createFixture(skillDomain);
		try {
			expect(validateFixture(fixtureRoot)).toEqual([]);
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects bare pnpm ci in active governance', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(fixtureRoot, '.agent/rules/gatekeeper.md', 'Run `pnpm ci`.\n');
			expect(validateFixture(fixtureRoot).join('\n')).toContain('use "pnpm run ci"');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects terminal plans under active and invalid archived status', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'.agent/plans/active/done.md',
				['---', 'title: Done', 'status: implemented', '---', '# Done'].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'.agent/plans/archived/old.md',
				['---', 'title: Old', 'status: archived', '---', '# Old'].join('\n'),
			);
			writeFixtureFile(fixtureRoot, 'CLAUDE.md', '# no\n');
			const output = validateFixture(fixtureRoot, ['CLAUDE.md']).join('\n');
			expect(output).toContain('must not remain under plans/active/');
			expect(output).toContain('status "archived" is invalid');
			expect(output).toContain('competing provider-owned policy entry point');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects machine-specific paths in portable policy files', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'.agent/rules/gatekeeper.md',
				'See C:/Users/alice/celebra/file.md\n',
			);
			const output = validateFixture(fixtureRoot, ['.agent/rules/gatekeeper.md']).join('\n');
			expect(output).toContain('machine-specific path');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('reports invalid references, metadata, plans, links, and tracked scratch files', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'.agent/agents/builder.yaml',
				['---', 'name: builder', 'skills:', '  - missing-skill'].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'.agent/skills/testing/SKILL.md',
				[
					'---',
					'name: testing',
					'description: Test guidance',
					'domain: unknown',
					'version: 1.0.0',
					'when_to_use:',
					'  - Testing changes',
					'preconditions:',
					'  - Read AGENTS.md',
					'related_skills: []',
					'related_docs: []',
					'---',
				].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'.agent/index.md',
				[
					'# Index',
					'- [`Missing`](../missing.md)',
					'## Available Skills',
					'| Skill | Purpose |',
					'| --- | --- |',
					'| `testing` | tests |',
					'## Workflows',
				].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'.agent/plans/active/current.md',
				['---', 'title: Current', 'status: unknown', '---'].join('\n'),
			);
			writeFixtureFile(fixtureRoot, 'scratch/note.tmp', 'temporary\n');

			const errors = validateFixture(fixtureRoot, ['scratch/note.tmp']);
			const output = errors.join('\n');

			expect(output).toContain('skill "missing-skill" does not resolve');
			expect(output).toContain('domain "unknown" is not permitted');
			expect(output).toContain('Markdown path "../missing.md" does not resolve');
			expect(output).toContain('plan status "unknown" is not recognized');
			expect(output).toContain('forbidden tracked artifact or scratch file');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects the retired workflow layer and requires registered provider adapters', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'.agent/workflows/example.md',
				[
					'---',
					'description: Example',
					'lifecycle: evergreen',
					'domain: governance',
					'---',
				].join('\n'),
			);
			writeFixtureFile(fixtureRoot, '.cursor/hooks.json', '{}\n');
			const errors = validateFixture(fixtureRoot, ['.cursor/hooks.json']).join('\n');
			expect(errors).toContain('.agent/workflows/example.md: .agent/workflows is retired');
			expect(errors).toContain('provider_adapters is required');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects an invalid skill precondition path and role schema', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'.agent/skills/testing/SKILL.md',
				[
					'---',
					'name: testing',
					'description: Test guidance',
					'domain: quality',
					'version: 1.0.0',
					'when_to_use:',
					'  - Testing changes',
					'preconditions:',
					'  - Read docs/missing-contract.md',
					'related_skills: []',
					'related_docs: []',
					'---',
				].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'.agent/agents/builder.yaml',
				['---', 'name: builder'].join('\n'),
			);
			const errors = validateFixture(fixtureRoot).join('\n');
			expect(errors).toContain(
				'precondition path "docs/missing-contract.md" does not resolve',
			);
			expect(errors).toContain('missing required role field "purpose"');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects duplicate provider adapters and unresolved shared owners', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(fixtureRoot, '.cursor/hooks.json', '{}\n');
			writeFixtureFile(
				fixtureRoot,
				'.agent/ownership.yaml',
				[
					'- aspect: "Task Contract, Goal protocol & Handoff Contract"',
					'  owner: ".agent/plans/README.md"',
					'- aspect: "Plans lifecycle & tracked plan governance"',
					'  owner: ".agent/plans/README.md"',
					'- aspect: "Git authorization & worktree safety"',
					'  owner: ".agent/rules/git-safety.md"',
					'- aspect: "testing"',
					'  owner: "AGENTS.md"',
					'provider_adapters:',
					'    - path: ".cursor/hooks.json"',
					'      provider: "cursor"',
					'      purpose: "hook registration"',
					'      shared_owners:',
					'          - "missing-owner.md"',
					'    - path: ".cursor/hooks.json"',
					'      provider: "cursor"',
					'      purpose: "duplicate hook registration"',
					'      shared_owners:',
					'          - "AGENTS.md"',
				].join('\n'),
			);
			const output = validateFixture(fixtureRoot, ['.cursor/hooks.json']).join('\n');
			expect(output).toContain('duplicate or empty provider adapter path');
			expect(output).toContain('adapter owner "missing-owner.md" does not resolve');
			expect(output).toContain('provider adapter must be registered exactly once');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});
	it('rejects stray deploy identity reads in src', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'src/lib/server/deploy-identity.ts',
				"export const read = () => getEnv('CELEBRA_DEPLOY_ENV');\n",
			);
			writeFixtureFile(
				fixtureRoot,
				'src/lib/leaky.ts',
				[
					"const a = getEnv('VERCEL_ENV');",
					'const b = process.env.VERCEL_GIT_COMMIT_SHA;',
					"const c = request.headers.get('x-vercel-id');",
					"const d = getEnv('CELEBRA_DEPLOY_ENV');",
					"const e = getEnv('NODE_ENV');",
					"const f = getEnv('VERCEL_AUTOMATION_BYPASS_SECRET');",
					"const g = 'message that names CELEBRA_DEPLOY_ENV';",
					"const h = process.env.NODE_ENV === 'production';",
					"const i = process.env.NODE_ENV === 'test';",
					'const j = import.meta.env.CELEBRA_DEPLOY_ENV;',
					'const { CELEBRA_DEPLOY_ENV: k } = process.env;',
					"const l = 'production' === process.env.NODE_ENV;",
					"const m = process.env['NODE_ENV'] !== 'production';",
				].join('\n'),
			);

			const output = validateFixture(fixtureRoot, [
				'src/lib/server/deploy-identity.ts',
				'src/lib/leaky.ts',
			]).join('\n');

			// Line 1 is reported once, by the retired-provider guard, for the whole file.
			expect(output).toContain(
				'src/lib/leaky.ts:1: names retired provider Vercel on 4 line(s).',
			);
			expect(output).not.toMatch(/src\/lib\/leaky\.ts:1: (?!names retired provider)/);
			expect(output).not.toContain('src/lib/leaky.ts:2:');
			expect(output).not.toContain('src/lib/leaky.ts:3:');
			expect(output).toContain('src/lib/leaky.ts:4: reads CELEBRA_DEPLOY_ENV outside');
			expect(output).toContain('src/lib/leaky.ts:5: reads NODE_ENV dynamically');
			expect(output).not.toContain('src/lib/leaky.ts:6:');
			expect(output).not.toContain('src/lib/leaky.ts:7:');
			expect(output).toContain('src/lib/leaky.ts:8: decides behavior from NODE_ENV');
			expect(output).not.toContain('src/lib/leaky.ts:9:');
			expect(output).toContain('src/lib/leaky.ts:10: reads CELEBRA_DEPLOY_ENV outside');
			expect(output).toContain('src/lib/leaky.ts:11: reads CELEBRA_DEPLOY_ENV outside');
			expect(output).toContain('src/lib/leaky.ts:12: decides behavior from NODE_ENV');
			expect(output).toContain('src/lib/leaky.ts:13: decides behavior from NODE_ENV');
			expect(output).not.toContain('src/lib/server/deploy-identity.ts:');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects static sharp imports under src but allows lazy and type-only ones', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'src/lib/static-sharp.ts',
				[
					"import sharp from 'sharp';",
					"import { type Metadata, default as s } from 'sharp';",
					"import * as sharpNs from 'sharp';",
					"import 'sharp';",
					"export { default } from 'sharp';",
					"const legacy = require('sharp');",
				].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'src/lib/lazy-sharp.ts',
				[
					"import type { Metadata } from 'sharp';",
					"export type { Sharp } from 'sharp';",
					"async function loadSharp() { return (await import('sharp')).default; }",
					"// a comment that mentions import sharp from 'sharp' is prose, not code",
					'const text = "import sharp from \'sharp\'";',
				].join('\n'),
			);
			writeFixtureFile(
				fixtureRoot,
				'scripts/tooling/uses-sharp.ts',
				"import sharp from 'sharp';\n",
			);

			const output = validateFixture(fixtureRoot, [
				'src/lib/static-sharp.ts',
				'src/lib/lazy-sharp.ts',
				'scripts/tooling/uses-sharp.ts',
			]).join('\n');

			expect(output).toContain('src/lib/static-sharp.ts:1: imports sharp statically');
			expect(output).toContain('src/lib/static-sharp.ts:2: imports sharp statically');
			expect(output).toContain('src/lib/static-sharp.ts:3: imports sharp statically');
			expect(output).toContain('src/lib/static-sharp.ts:4: imports sharp statically');
			expect(output).toContain('src/lib/static-sharp.ts:5: re-exports sharp statically');
			expect(output).toContain('src/lib/static-sharp.ts:6: requires sharp statically');
			expect(output).not.toContain('src/lib/lazy-sharp.ts:1:');
			expect(output).not.toContain('src/lib/lazy-sharp.ts:2:');
			expect(output).not.toContain('src/lib/lazy-sharp.ts:3:');
			expect(output).not.toContain('src/lib/lazy-sharp.ts:5:');
			expect(output).not.toContain('scripts/tooling/uses-sharp.ts:');
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('rejects retired Vercel and Cloudinary mentions outside the allow-list', () => {
		const fixtureRoot = createFixture();
		try {
			writeFixtureFile(
				fixtureRoot,
				'docs/hosting.md',
				[
					'# Hosting',
					'Intro',
					'Deployed on Vercel.',
					'Images on vercel and Cloudinary.',
				].join('\n'),
			);
			writeFixtureFile(fixtureRoot, 'src/lib/clean.ts', 'export const host = "workers";\n');
			writeFixtureFile(fixtureRoot, 'CHANGELOG.md', '- Removed Vercel and Cloudinary.\n');
			writeFixtureFile(
				fixtureRoot,
				'supabase/migrations/20260101000000_cloudinary.sql',
				"-- cloudinary provider\nselect 'vercel';\n",
			);
			const trackedFiles = [
				'docs/hosting.md',
				'src/lib/clean.ts',
				'CHANGELOG.md',
				'supabase/migrations/20260101000000_cloudinary.sql',
			];
			const script = `
				import { validateStructure, validateStructureWarnings } from ${JSON.stringify(SCRIPT_URL)};
				import { validateNoVercelReferences } from ${JSON.stringify(RETIRED_PROVIDER_URL)};
				const input = { root: ${JSON.stringify(fixtureRoot)}, trackedFiles: ${JSON.stringify(trackedFiles)} };
				process.stdout.write(JSON.stringify({
					warnings: validateStructureWarnings(input),
					errors: validateStructure(input),
					strict: validateNoVercelReferences(input.root, input.trackedFiles, 'error'),
				}));
			`;
			const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
				cwd: ROOT,
			});
			const output = JSON.parse(result.stdout) as {
				warnings: string[];
				errors: string[];
				strict: { errors: string[]; warnings: string[] };
			};

			expect(output.warnings).toEqual([]);
			expect(output.errors).toEqual([
				'docs/hosting.md:3: names retired provider Vercel on 2 line(s).',
				'docs/hosting.md:4: names retired provider Cloudinary on 1 line(s).',
			]);
			expect(output.strict.errors).toHaveLength(2);
			expect(output.strict.warnings).toEqual([]);
		} finally {
			rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});
});
