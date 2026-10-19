import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	ENV_FILES,
	auditTemplate,
	compareEnvFile,
	findUnreadNames,
	readCodeCorpus,
	readTemplateNames,
} from '../../scripts/agent/env-files.ts';

const ROOT = process.cwd();

function readTemplate(template: string): string {
	return readFileSync(join(ROOT, template), 'utf8');
}

function templateNames(template: string): string[] {
	return readTemplateNames(readTemplate(template));
}

describe('env file templates', () => {
	const corpus = readCodeCorpus(ROOT);

	it.each(ENV_FILES.map((spec) => [spec.template]))(
		'%s lists unique names that code actually reads',
		(template) => {
			const names = templateNames(template);
			expect(names.length).toBeGreaterThan(0);
			expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
			expect(findUnreadNames(names, corpus)).toEqual([]);
		},
	);

	it.each(ENV_FILES.map((spec) => [spec.template]))(
		'%s documents every name and mentions no retired provider',
		(template) => {
			expect(auditTemplate(readTemplate(template))).toEqual({
				undocumented: [],
				emptySections: [],
				staleCommentLines: [],
			});
		},
	);

	it('flags undocumented names, empty sections and retired providers', () => {
		const source = [
			'# ------------------------------------------------------------------------------',
			'# Runtime',
			'# ------------------------------------------------------------------------------',
			'# Documented.',
			'A=1',
			'B=2',
			'',
			'C=3',
			'',
			'# ------------------------------------------------------------------------------',
			'# Cloudinary',
			'# ------------------------------------------------------------------------------',
			'',
			'# Vercel Cron bearer secret.',
		].join('\n');
		expect(auditTemplate(source)).toEqual({
			undocumented: ['C'],
			emptySections: ['Cloudinary'],
			staleCommentLines: [11, 14],
		});
	});

	it('keeps test runner and Production operator names in their own file only', () => {
		const local = new Set(templateNames('.env.example'));
		const preview = new Set(templateNames('.env.preview.local.example'));
		for (const template of ['.env.e2e.local.example', '.env.production.local.example']) {
			for (const name of templateNames(template)) {
				expect([name, local.has(name) || preview.has(name)]).toEqual([name, false]);
			}
		}
		expect(
			templateNames('.env.production.local.example').every((name) =>
				name.startsWith('PROD_'),
			),
		).toBe(true);
		expect(
			templateNames('.env.preview.local.example').filter((name) =>
				/PRODUCTION|^PROD_/.test(name),
			),
		).toEqual([]);
	});

	it('reports missing, empty and unknown names without values', () => {
		expect(
			compareEnvFile('.env.x', ['A', 'B', 'C'], { A: 'value', B: ' ', EXTRA: 'x' }),
		).toEqual({
			file: '.env.x',
			present: true,
			missing: ['C'],
			empty: ['B'],
			unknown: ['EXTRA'],
		});
		expect(compareEnvFile('.env.x', ['A'], null)).toEqual({
			file: '.env.x',
			present: false,
			missing: ['A'],
			empty: [],
			unknown: [],
		});
	});
});
