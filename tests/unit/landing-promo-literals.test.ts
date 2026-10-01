import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
	formatMxn,
	formatMxnAmount,
	getExpressDelivery,
	PROMO_CAMPAIGN,
} from '@/data/promo-campaign.data';

/**
 * Guards the promo single source of truth: prices, promo codes and campaign dates live only in
 * `src/data/promo-campaign.data.ts`; every other file must derive them from that module.
 */

const ROOT = process.cwd();
const PROMO_MODULE = ['src', 'data', 'promo-campaign.data.ts'].join(sep);
const TEXT_EXTENSIONS = /\.(astro|ts|tsx|js|mjs|cjs|scss|md|json)$/;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'visual-baselines', '.astro', 'dist']);

/** Previous campaign prefix, assembled so this guard does not contain it verbatim. */
const RETIRED_CAMPAIGN_PREFIX = ['LANZA', 'MIENTO'].join('');

/** Surfaces that render or transmit landing prices. */
const LANDING_SURFACES = [
	'src/components/home',
	'src/components/ui/WhatsAppButton.astro',
	'src/data',
	'src/layouts/Layout.astro',
	'src/lib/tracking/client.ts',
	'src/pages/index.astro',
	'src/pages/privacidad.astro',
	'src/pages/terminos.astro',
	'src/styles/home',
];

function collectFiles(path: string): string[] {
	const absolute = join(ROOT, path);
	if (statSync(absolute).isFile()) return TEXT_EXTENSIONS.test(path) ? [path] : [];
	return readdirSync(absolute).flatMap((entry) =>
		SKIPPED_DIRECTORIES.has(entry) ? [] : collectFiles(join(path, entry)),
	);
}

function findOffenders(files: string[], patterns: RegExp[]): string[] {
	return files
		.filter((file) => relative(ROOT, join(ROOT, file)) !== PROMO_MODULE)
		.flatMap((file) => {
			const source = readFileSync(join(ROOT, file), 'utf8');
			return patterns
				.filter((pattern) => pattern.test(source))
				.map((pattern) => `${file} → ${pattern.source}`);
		});
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('landing promo literals', () => {
	it('keeps the retired launch campaign out of src/ and tests/', () => {
		const files = [...collectFiles('src'), ...collectFiles('tests')];
		expect(findOffenders(files, [new RegExp(RETIRED_CAMPAIGN_PREFIX)])).toEqual([]);
	});

	it('writes promo codes only in the promo module', () => {
		const files = [...collectFiles('src'), ...collectFiles('tests')];
		const codePattern = new RegExp(`\\b${escapeRegExp(PROMO_CAMPAIGN.codePrefix)}-\\d+`);
		expect(findOffenders(files, [codePattern])).toEqual([]);
	});

	it('writes promo prices and dates only in the promo module', () => {
		const amounts = [
			...PROMO_CAMPAIGN.packages.flatMap((pkg) => [pkg.promoPrice, pkg.regularPrice]),
			getExpressDelivery().price,
		];
		const pricePatterns = amounts.flatMap((amount) => [
			new RegExp(`${escapeRegExp(formatMxn(amount))}(?![\\d,])`),
			...(amount >= 1000
				? [new RegExp(`(?<![\\d,])${escapeRegExp(formatMxnAmount(amount))}(?![\\d,])`)]
				: []),
		]);
		const datePatterns = [
			new RegExp(escapeRegExp(PROMO_CAMPAIGN.endLabel)),
			new RegExp(escapeRegExp(PROMO_CAMPAIGN.startsAt.slice(0, 10))),
			new RegExp(escapeRegExp(PROMO_CAMPAIGN.endsAt.slice(0, 10))),
		];
		const files = LANDING_SURFACES.flatMap(collectFiles);

		expect(findOffenders(files, [...pricePatterns, ...datePatterns])).toEqual([]);
	});
});
