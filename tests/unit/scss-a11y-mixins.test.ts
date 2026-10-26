import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { compileString } from 'sass';

/**
 * Reduced-motion queries, 44px touch targets and 2px focus offsets come from the shared mixins in
 * `src/styles/global/_a11y.scss`, and stylelint refuses hand-written copies. Only the mixin module
 * and the frozen legacy profiles (their digest may not change) are exempt.
 */
const ROOT = process.cwd();
const GLOBAL_DIR = path.join(ROOT, 'src/styles/global');
const A11Y_MODULE = 'src/styles/global/_a11y.scss';
const STYLELINT_BIN = path.join(ROOT, 'node_modules/stylelint/bin/stylelint.mjs');

function compileWithA11y(body: string): string {
	return compileString(`@use 'a11y';\n${body}`, { loadPaths: [GLOBAL_DIR] }).css;
}

function lint(code: string, file: string): string[] {
	const result = spawnSync(
		process.execPath,
		[STYLELINT_BIN, '--stdin-filename', file, '--formatter', 'json'],
		{ cwd: ROOT, input: code, encoding: 'utf8' },
	);
	const reports = JSON.parse(result.stdout || result.stderr) as Array<{
		warnings: Array<{ rule: string }>;
	}>;
	return reports.flatMap((report) => report.warnings.map((warning) => warning.rule));
}

function scssFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return scssFiles(full);
		return entry.name.endsWith('.scss') ? [full] : [];
	});
}

describe('shared accessibility mixins', () => {
	it('emit no CSS when the module is only loaded', () => {
		expect(compileWithA11y('').trim()).toBe('');
	});

	it('compile to the declarations they replace', () => {
		const css = compileWithA11y(`
			.a { @include a11y.touch-target; }
			.b { @include a11y.focus-ring; }
			.c { @include a11y.focus-ring(Highlight); }
			.d { @include a11y.focus-ring(var(--accent), 1px); }
			@include a11y.reduced-motion { .e { animation: none; } }
			@include a11y.motion-safe { .f { transition: opacity 1s; } }
		`);

		expect(css).toContain('.a {\n  min-height: 44px;\n}');
		expect(css).toContain(
			'.b {\n  outline: 2px solid var(--dashboard-focus-ring);\n  outline-offset: 2px;\n}',
		);
		expect(css).toContain('.c {\n  outline: 2px solid Highlight;\n  outline-offset: 2px;\n}');
		expect(css).toContain(
			'.d {\n  outline: 1px solid var(--accent);\n  outline-offset: 2px;\n}',
		);
		expect(css).toContain('@media (prefers-reduced-motion: reduce) {\n  .e {');
		expect(css).toContain('@media (prefers-reduced-motion: no-preference) {\n  .f {');
	});

	it('stay reachable through the mixins module', () => {
		const css = compileString(
			`@use 'mixins';\n.a { @include mixins.touch-target; @include mixins.focus-ring; }`,
			{ loadPaths: [GLOBAL_DIR] },
		).css;

		expect(css).toContain('min-height: 44px;');
		expect(css).toContain('outline-offset: 2px;');
	});
});

describe('hand-written accessibility patterns', () => {
	const handWritten = [
		'.a {',
		'\tmin-height: 44px;',
		'\toutline-offset: 2px;',
		'',
		'\t@media (prefers-reduced-motion: reduce) {',
		'\t\tanimation: none;',
		'\t}',
		'}',
		'',
	].join('\n');

	it('are refused by stylelint', () => {
		expect(lint(handWritten, 'src/styles/home/_probe.scss').sort()).toEqual([
			'declaration-property-value-disallowed-list',
			'declaration-property-value-disallowed-list',
			'media-feature-name-disallowed-list',
		]);
	});

	it('are allowed only in the mixin module and frozen profiles', () => {
		expect(lint(handWritten, A11Y_MODULE)).toEqual([]);
		expect(lint(handWritten, 'src/styles/invitation-profiles/renata.scss')).toEqual([]);
	});

	it('leave no hand-written copy outside the exempt files', () => {
		const config = JSON.parse(
			fs.readFileSync(path.join(ROOT, '.stylelintrc.json'), 'utf8'),
		) as {
			overrides: Array<{ files: string[] }>;
		};
		const exempt = new Set(config.overrides.flatMap((override) => override.files));
		for (const file of exempt)
			expect({ file, exists: fs.existsSync(file) }).toEqual({ file, exists: true });

		const offenders = scssFiles(path.join(ROOT, 'src'))
			.map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
			.filter((file) => !exempt.has(file))
			.filter((file) =>
				/@media[^{]*prefers-reduced-motion|^\s*min-height:\s*44px\s*;|^\s*outline-offset:\s*2px\s*;/mu.test(
					fs.readFileSync(file, 'utf8'),
				),
			);
		expect(offenders).toEqual([]);
	});
});
