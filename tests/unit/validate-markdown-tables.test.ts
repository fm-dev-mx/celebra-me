import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const RULE_MODULE = pathToFileURL(
	path.join(ROOT, 'scripts', 'markdownlint', 'table-readability.mjs'),
).href;

function evaluateModuleScript<T>(script: string): T {
	const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: ROOT,
	});
	return JSON.parse(result.stdout) as T;
}

describe('Markdown table readability rules', () => {
	it('uses the Markdown parser for tables, escaped pipes, code, links, and fences', () => {
		const result = evaluateModuleScript<{
			issues: number;
			active: boolean;
			archived: boolean;
		}>(`
			import { lint } from 'markdownlint/sync';
			import rules from ${JSON.stringify(RULE_MODULE)};
			const nl = String.fromCharCode(10);
			const tick = String.fromCharCode(96);
			const escapedPipe = String.fromCharCode(92) + '|';
			const fence = tick.repeat(3);
			const longDestination = 'https://example.test/' + 'x'.repeat(300);
			const content = [
				'| Field | Value |',
				'| --- | --- |',
				'| ' + tick + 'a' + escapedPipe + 'b' + tick + ' | [Read this](' + longDestination + ') |',
				'| escaped ' + escapedPipe + ' pipe | short |',
				'',
				fence + 'md',
				'| ignored | table | prose |',
				'| --- | --- | --- |',
				'| ' + 'x'.repeat(300) + ' | value | value |',
				fence,
			].join(nl);
			const config = { default: false, 'celebra-table-columns': { severity: 'warning' }, 'celebra-table-narrative': { severity: 'warning' }, 'celebra-table-hard-limit': { severity: 'error' } };
			const active = lint({ strings: { 'docs/core/example.md': content }, customRules: rules, config });
			const archived = lint({ strings: { '.agent/plans/archived/example.md': content }, customRules: rules, config });
			process.stdout.write(JSON.stringify({
				issues: active['docs/core/example.md'].length,
				active: active['docs/core/example.md'].length === 0,
				archived: archived['.agent/plans/archived/example.md'].length === 0,
			}));
		`);

		expect(result).toEqual({ issues: 0, active: true, archived: true });
	});

	it('warns at 121 characters, blocks above 240, and keeps four columns advisory', () => {
		const result = evaluateModuleScript<{
			at120: { warnings: number; errors: number };
			at121: { warnings: number; errors: number };
			at240: { warnings: number; errors: number };
			at241: { warnings: number; errors: number };
			fiveColumns: { warnings: number; errors: number };
		}>(`
			import { lint } from 'markdownlint/sync';
			import rules from ${JSON.stringify(RULE_MODULE)};
			const makeConfig = { default: false, 'celebra-table-columns': { severity: 'warning', maxColumns: 4 }, 'celebra-table-narrative': { severity: 'warning', maxCharacters: 120 }, 'celebra-table-hard-limit': { severity: 'error', maxCharacters: 240 } };
			const table = (length, columns = 4) => {
				const headers = Array.from({ length: columns }, (_, index) => String.fromCharCode(65 + index));
				const divider = headers.map(() => '---');
				const values = headers.map((_, index) => index === 1 ? 'x'.repeat(length) : 'short');
				return ['| ' + headers.join(' | ') + ' |', '| ' + divider.join(' | ') + ' |', '| ' + values.join(' | ') + ' |'].join(String.fromCharCode(10));
			};
			const check = (content) => {
				const result = lint({ strings: { 'docs/core/example.md': content }, customRules: rules, config: makeConfig })['docs/core/example.md'];
				return { warnings: result.filter((item) => item.severity === 'warning').length, errors: result.filter((item) => item.severity === 'error').length };
			};
			process.stdout.write(JSON.stringify({ at120: check(table(120)), at121: check(table(121)), at240: check(table(240)), at241: check(table(241)), fiveColumns: check(table(10, 5)) }));
		`);

		expect(result.at120).toEqual({ warnings: 0, errors: 0 });
		expect(result.at121.warnings).toBeGreaterThan(0);
		expect(result.at121.errors).toBe(0);
		expect(result.at240.warnings).toBeGreaterThan(0);
		expect(result.at240.errors).toBe(0);
		expect(result.at241.errors).toBe(1);
		expect(result.fiveColumns.warnings).toBe(1);
		expect(result.fiveColumns.errors).toBe(0);
	});

	it('converts one narrative table into stable record lists and is idempotent', () => {
		const result = evaluateModuleScript<{
			fixed: string;
			initialWarnings: number;
			initialErrors: number;
			secondPassIssues: number;
		}>(`
			import { lint } from 'markdownlint/sync';
			import { applyFixes } from 'markdownlint';
			import rules from ${JSON.stringify(RULE_MODULE)};
			const nl = String.fromCharCode(10);
			const long =
				'Mi mejor regalo es tu presencia, pero si deseas tener un detalle conmigo, puedes hacerlo dentro de un sobre y conservar este mensaje para la celebración.' +
				'x'.repeat(100);
			const content = [
				'| field | value | source | classification |',
				'| --- | --- | --- | --- |',
				'| giftsLegend | ' + long + ' | owner reference | verified |',
				'| eventLabel | 70 Años | client correction | verified |',
			].join(nl);
			const config = { default: false, 'celebra-table-columns': { severity: 'warning' }, 'celebra-table-narrative': { severity: 'warning' }, 'celebra-table-hard-limit': { severity: 'error' } };
			const first = lint({ strings: { 'docs/core/example.md': content }, customRules: rules, config })['docs/core/example.md'];
			const fixed = applyFixes(content, first);
			const second = lint({ strings: { 'docs/core/example.md': fixed }, customRules: rules, config })['docs/core/example.md'];
			process.stdout.write(JSON.stringify({
				fixed,
				initialWarnings: first.filter((item) => item.severity === 'warning').length,
				initialErrors: first.filter((item) => item.severity === 'error').length,
				secondPassIssues: second.length,
			}));
		`);

		expect(result.initialWarnings).toBeGreaterThan(0);
		expect(result.initialErrors).toBe(1);
		expect(result.fixed).toContain('- **field:** giftsLegend');
		expect(result.fixed).toContain('  - **value:** Mi mejor regalo');
		expect(result.fixed).toContain('  - **source:** owner reference');
		expect(result.fixed).toContain('- **field:** eventLabel');
		expect(result.fixed).not.toContain('| --- |');
		expect(result.secondPassIssues).toBe(0);
	});

	it('recognizes active documentation paths and excludes generated, fixture, and historical paths', () => {
		const result = evaluateModuleScript<boolean[]>(`
			import { isActiveMarkdownPath } from ${JSON.stringify(RULE_MODULE)};
			process.stdout.write(JSON.stringify([
				isActiveMarkdownPath('docs/core/project-conventions.md'),
				isActiveMarkdownPath('.agent/skills/testing/SKILL.md'),
				isActiveMarkdownPath('.agent/plans/archived/old.md'),
				isActiveMarkdownPath('output/report.md'),
				isActiveMarkdownPath('tests/fixtures/example.md'),
			]));
		`);

		expect(result).toEqual([true, true, false, false, false]);
	});
});
