import { isVisualImpactPath, visualImpactFiles } from '../../scripts/ops/visual-impact.ts';

describe('visual impact contract', () => {
	it.each([
		'src/components/invitation/Countdown.astro',
		'src/layouts/Layout.astro',
		'src/pages/index.astro',
		'src/styles/themes/sections/countdown/_magazine-folio.scss',
		'src/content/config.ts',
		'public/fonts/example.woff2',
		'tests/e2e/visual-baselines/manifest.json',
		'scripts/screenshot/visual-parity-cli.ts',
		'playwright.config.ts',
	])('classifies %s as visual', (path) => expect(isVisualImpactPath(path)).toBe(true));

	it('normalizes, deduplicates, and excludes nonvisual operational files', () => {
		expect(
			visualImpactFiles([
				'src\\styles\\app.scss',
				'src/styles/app.scss',
				'scripts/ops/ci-metrics.ts',
			]),
		).toEqual(['src/styles/app.scss']);
	});
});
