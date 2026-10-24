import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tuFormPattern } from '../helpers/tu-register';

const DEMOS_DIR = join(process.cwd(), 'src/invitations/demos');

/** Demos the owner chose to keep in "tú" (decision d168: Valentina Noir). */
const TU_REGISTER_DEMOS = new Set(['demo-xv-editorial']);

const demoSlugs = readdirSync(DEMOS_DIR, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

/** Collects every string value of a parsed JSON document with its path; keys are skipped. */
function stringValues(node: unknown, path = ''): Array<{ path: string; text: string }> {
	if (typeof node === 'string') return [{ path, text: node }];
	if (Array.isArray(node))
		return node.flatMap((item, index) => stringValues(item, `${path}[${index}]`));
	if (node && typeof node === 'object') {
		return Object.entries(node).flatMap(([key, value]) =>
			stringValues(value, path ? `${path}.${key}` : key),
		);
	}
	return [];
}

describe('demo copy register', () => {
	it('finds the demo content files', () => {
		expect(demoSlugs.length).toBeGreaterThan(0);
	});

	it.each(demoSlugs.filter((slug) => !TU_REGISTER_DEMOS.has(slug)))(
		'addresses guests with "usted" in %s',
		(slug) => {
			const content = JSON.parse(readFileSync(join(DEMOS_DIR, slug, 'content.json'), 'utf8'));
			const offenders = stringValues(content)
				.filter(({ text }) => tuFormPattern.test(text))
				.map(({ path, text }) => `${path}: ${text}`);
			expect(offenders).toEqual([]);
		},
	);
});
