import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts', 'ops', 'vercel-ignore-build.mjs')).href;
const previousSha = 'a'.repeat(40);

interface Decision {
	build: boolean;
	reason: string;
}

/** The script is plain ESM for Vercel's build container; Jest evaluates it through node itself. */
function evaluate<T>(expression: string): T {
	const script = `import { decideBuild, isApplicationInput } from ${JSON.stringify(MODULE)};
process.stdout.write(JSON.stringify(${expression}));`;
	const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: ROOT,
	});
	return JSON.parse(result.stdout) as T;
}

function decide(input: {
	environment?: string;
	previousSha?: string;
	changedPaths: string[] | null;
}): Decision {
	return evaluate<Decision>(`decideBuild(${JSON.stringify(input)})`);
}

describe('Vercel ignored build step', () => {
	it('binds vercel.json to the ignore script and to the build without the repeated type-check', () => {
		const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
			buildCommand?: string;
			ignoreCommand?: string;
		};
		expect(config.buildCommand).toBe('pnpm build:app');
		expect(config.ignoreCommand).toBe('node scripts/ops/vercel-ignore-build.mjs');
	});

	it('classifies application inputs and ignores repository-only paths', () => {
		const inputs = [
			'src/styles/landing.scss',
			'src/content/invitations/demo.json',
			'public/fonts/example.woff2',
			'scripts/shared/celebra-runtime-env.ts',
			'astro.config.mjs',
			'vercel.json',
			'package.json',
			'pnpm-lock.yaml',
		];
		const others = [
			'docs/core/release-process.md',
			'.github/workflows/commit-validation.yml',
			'scripts/ops/release-status.ts',
			'tests/unit/example.test.ts',
			'supabase/migrations/0001.sql',
		];
		const classified = evaluate<Record<string, boolean>>(
			`Object.fromEntries(${JSON.stringify([...inputs, ...others])}.map((p) => [p, isApplicationInput(p)]))`,
		);
		for (const input of inputs) expect(classified[input]).toBe(true);
		for (const other of others) expect(classified[other]).toBe(false);
	});

	it('always builds Production and unknown environments', () => {
		expect(decide({ environment: 'production', previousSha, changedPaths: [] }).build).toBe(
			true,
		);
		expect(decide({ previousSha, changedPaths: [] }).build).toBe(true);
	});

	it('builds when the previous deployment or its diff is unknown', () => {
		expect(decide({ environment: 'preview', previousSha: '', changedPaths: [] }).build).toBe(
			true,
		);
		expect(decide({ environment: 'preview', previousSha, changedPaths: null }).build).toBe(
			true,
		);
	});

	it('skips a Preview build only when no application input changed', () => {
		const skipped = decide({
			environment: 'preview',
			previousSha,
			changedPaths: ['docs/core/release-process.md', 'tests/unit/example.test.ts'],
		});
		expect(skipped.build).toBe(false);
		expect(skipped.reason).toContain(previousSha);

		const built = decide({
			environment: 'preview',
			previousSha,
			changedPaths: ['docs/core/release-process.md', 'src\\styles\\landing.scss'],
		});
		expect(built.build).toBe(true);
		expect(built.reason).toContain('src/styles/landing.scss');
	});

	it('exits 1 (build) outside Preview when executed as the ignore command', () => {
		const result = runCommand(process.execPath, ['scripts/ops/vercel-ignore-build.mjs'], {
			cwd: ROOT,
			allowFailure: true,
			env: { ...process.env, VERCEL_ENV: 'production', VERCEL_GIT_PREVIOUS_SHA: previousSha },
		});
		expect(result.status).toBe(1);
		expect(result.stdout).toContain('[vercel-ignore-build] build');
	});
});
