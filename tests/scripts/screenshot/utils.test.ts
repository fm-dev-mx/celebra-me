import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	parseCliArgs,
	resolveViewports,
	loadScreenshotConfig,
	writeScreenshotReport,
	getDefaultCriticalSelectors,
	getDefaultHideSelectors,
	getExpectedCaptureCount,
	buildCurrentRunManifest,
	classifyConsoleError,
	getViewportProfileSummary,
} from '../../../scripts/screenshot/utils';
import type { ScreenshotRunReport } from '../../../scripts/screenshot/types';

describe('screenshot CLI utilities', () => {
	it('defaults direct captures to audit mode unless raw is requested', () => {
		expect(parseCliArgs(['node', 'cli.ts', '--url=/']).mode).toBeUndefined();
		expect(parseCliArgs(['node', 'cli.ts', '--url=/', '--mode=raw']).mode).toBe('raw');
		expect(parseCliArgs(['node', 'cli.ts', '--url=/', '--mode=audit']).mode).toBe('audit');
	});

	it('resolves mobile-small as a temporary alias for canonical mobile-narrow', () => {
		const [viewport] = resolveViewports('site', ['mobile-small']);

		expect(viewport).toEqual({
			name: 'mobile-narrow',
			width: 360,
			height: 740,
			deviceScaleFactor: 2,
		});
	});

	it('describes the site profile with mobile-narrow included', () => {
		expect(getViewportProfileSummary('site')).toBe(
			'mobile-narrow, mobile-standard, tablet, desktop',
		);
	});

	it('includes automatic audit critical captures in expected counts', () => {
		expect(
			getExpectedCaptureCount({
				pageType: 'landing',
				mode: 'audit',
				target: 'critical-qa',
				includeLayout: true,
				criticalSelectors: getDefaultCriticalSelectors('landing'),
			}),
		).toBe(10);

		expect(
			getExpectedCaptureCount({
				pageType: 'landing',
				mode: 'raw',
				target: 'critical-qa',
				includeLayout: true,
				criticalSelectors: getDefaultCriticalSelectors('landing'),
			}),
		).toBe(5);
	});

	it('builds current-run manifests without counting stale output files', () => {
		const [mobileNarrow, desktop] = resolveViewports('site', ['mobile-narrow', 'desktop']);
		const manifest = buildCurrentRunManifest({
			viewports: [mobileNarrow, desktop],
			perViewportPlanned: { 'mobile-narrow': 3, 'desktop': 3 },
			target: 'critical-qa',
			captures: [
				{
					path: 'temp/screenshots/home/mobile-narrow/01-viewport.png',
					viewportName: 'mobile-narrow',
					label: 'Viewport',
					success: true,
				},
				{
					path: 'temp/screenshots/home/mobile-narrow/02-full-page.png',
					viewportName: 'mobile-narrow',
					label: 'Full page',
					success: true,
				},
				{
					path: 'temp/screenshots/home/mobile-narrow/20-critical-main.png',
					viewportName: 'mobile-narrow',
					label: 'Critical: main',
					success: true,
				},
				{
					path: 'temp/screenshots/home/mobile-large/01-viewport.png',
					viewportName: 'mobile-large',
					label: 'Stale viewport',
					success: true,
				},
			],
		});

		expect(manifest).toEqual([
			{ name: 'desktop', files: 0, expected: 3, status: 'failed' },
			{ name: 'mobile-narrow', files: 3, expected: 3, status: 'passed' },
		]);
	});

	it('classifies known dev-only console errors without treating them as screenshot blocking', () => {
		const classified = classifyConsoleError('pageerror: __name is not defined');

		expect(classified).toMatchObject({
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			affectsScreenshotReliability: false,
		});
	});

	it('provides default audit overlay selectors for consent normalization', () => {
		expect(getDefaultHideSelectors()).toContain('[data-consent-banner]');
		expect(getDefaultHideSelectors()).toContain('[aria-label*="cookie" i]');
	});

	it('loads simple screenshot configs with mode and page critical selectors', () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), 'celebra-screenshot-config-'));
		const configPath = path.join(tempDir, 'screenshot.config.json');

		try {
			const configSource = {
				baseUrl: 'http://localhost:4321',
				defaultMode: 'audit',
				defaultViewportProfile: 'site',
				outputDir: 'temp/screenshots',
				pages: [
					{
						name: 'Landing',
						pageType: 'landing',
						route: '/',
						criticalSelectors: [
							{ selector: 'main', required: true, capture: true },
							{ selector: '[data-optional]', required: false },
						],
					},
				],
			};
			writeFileSync(configPath, JSON.stringify(configSource), 'utf8');

			const config = loadScreenshotConfig(configPath);

			expect(config.defaultMode).toBe('audit');
			expect(config.outputDir).toBe('temp/screenshots');
			expect(config.pages?.[0]?.criticalSelectors).toEqual([
				{ selector: 'main', required: true, capture: true },
				{ selector: '[data-optional]', required: false },
			]);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('writes a machine-readable run report', async () => {
		const tempDir = mkdtempSync(path.join(tmpdir(), 'celebra-screenshot-report-'));
		try {
			const report: ScreenshotRunReport = {
				route: '/',
				mode: 'audit',
				startedAt: '2026-07-02T00:00:00.000Z',
				durationMs: 123,
				status: 'passed',
				viewports: [
					{
						name: 'mobile-narrow',
						width: 360,
						height: 740,
						deviceScaleFactor: 2,
						documentHeight: 1200,
						outputFiles: [
							{
								path: 'screenshots/home/mobile-narrow/02-full-page.png',
								label: 'Full page',
								width: 720,
								height: 2400,
							},
						],
						criticalSelectors: [
							{
								selector: 'main',
								required: true,
								visibleBeforeNormalization: true,
								visibleAfterNormalization: true,
								status: 'passed',
							},
						],
						warnings: [],
						failures: [],
						consoleErrors: [],
						requestFailures: [],
					},
				],
				manifest: [],
				warnings: [],
				failures: [],
			};

			const reportPath = await writeScreenshotReport(tempDir, report);
			const written = JSON.parse(readFileSync(reportPath, 'utf8')) as ScreenshotRunReport;

			expect(path.basename(reportPath)).toBe('report.json');
			expect(written).toEqual(report);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
