import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import baseline from '../fixtures/style-scale-literals/baseline.json';
import invitationBaseline from '../fixtures/style-scale-literals/invitation-baseline.json';

/**
 * Ratchet for literal `border-radius` and `font-size` values. Values should come from tokens:
 * `--radius-*` for radii, a `type-scale` text style or a font-size variable for type. Each file may
 * keep at most its baseline count of literals; a new file starts at zero. When a migration lowers a
 * count, lower the baseline in the same change. Dashboard/landing and invitation styles keep
 * separate baselines because they migrate on separate schedules.
 */

const ROOT = process.cwd();
const RATCHETS = [
	{
		name: 'dashboard and landing styles',
		scopes: ['src/styles/dashboard', 'src/styles/home'],
		baseline: baseline as Record<string, number>,
	},
	{
		name: 'invitation and preset styles',
		scopes: [
			'src/styles/invitation',
			'src/styles/invitation-presets',
			'src/styles/invitation-profiles',
			'src/styles/invitation-sections-by-preset',
			'src/styles/themes/presets',
			'src/styles/themes/sections',
		],
		baseline: invitationBaseline as Record<string, number>,
	},
];
const DECLARATION = /^\s*(border-radius|font-size)\s*:\s*([^;{}]+);/gm;
const TOKEN_VALUE = [/^var\(--/, /^\$/, /^[a-z-]+\.\$/];
const ALLOWED: Record<string, RegExp[]> = {
	'border-radius': [/^0$/, /^50%$/, /^inherit$/, /^calc\(/, ...TOKEN_VALUE],
	'font-size': [/^inherit$/, /^[0-9.]+(em|%)$/, /^[a-z-]+\.[a-z-]+\(/, ...TOKEN_VALUE],
};

function countLiterals(source: string): number {
	return [...source.matchAll(DECLARATION)].filter(
		([, property, value]) => !ALLOWED[property].some((pattern) => pattern.test(value.trim())),
	).length;
}

function collectCounts(scopes: string[]): Record<string, number> {
	return Object.fromEntries(
		scopes.flatMap((scope) =>
			readdirSync(join(ROOT, scope), { recursive: true })
				.map(String)
				.filter((file) => file.endsWith('.scss'))
				.map((file) => {
					const path = `${scope}/${file.split('\\').join('/')}`;
					return [path, countLiterals(readFileSync(join(ROOT, path), 'utf8'))] as const;
				})
				.filter(([, count]) => count > 0),
		),
	);
}

describe.each(RATCHETS)('style scale literals in $name', ({ scopes, baseline: allowed }) => {
	const counts = collectCounts(scopes);

	it('adds no literal border-radius or font-size beyond each file baseline', () => {
		const grown = Object.entries(counts)
			.filter(([file, count]) => count > (allowed[file] ?? 0))
			.map(([file, count]) => `${file}: ${count} literals, baseline ${allowed[file] ?? 0}`);
		expect(grown).toEqual([]);
	});

	it('lowers the baseline when a file drops literals', () => {
		const stale = Object.entries(allowed)
			.filter(([file, limit]) => (counts[file] ?? 0) < limit)
			.map(([file, limit]) => `${file}: baseline ${limit}, now ${counts[file] ?? 0}`);
		expect(stale).toEqual([]);
	});
});
