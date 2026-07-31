import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'validate-structure.mjs');
const SCRIPT_URL = pathToFileURL(SCRIPT_PATH).href;

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
		['---', 'name: builder', 'skills:', '  - testing'].join('\n'),
	);
	writeFixtureFile(
		root,
		'.agent/ownership.yaml',
		['- aspect: "testing"', '  owner: "AGENTS.md"'].join('\n'),
	);
	writeFixtureFile(root, '.agent/rules/gatekeeper.md', '# Gatekeeper\n');
	writeFixtureFile(
		root,
		'.agent/routing-matrix.yaml',
		[
			'bootstrap:',
			'  rules:',
			'    - ".agent/rules/gatekeeper.md"',
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
});
