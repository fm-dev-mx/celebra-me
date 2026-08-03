import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	parseCliArgs,
	resolveViewports,
	loadScreenshotConfig,
	writeScreenshotReport,
	getDefaultHideSelectors,
	getOperationalToolbarSelectors,
	buildCurrentRunManifest,
	classifyConsoleError,
	dedupeScreenshotNotices,
	computeScreenshotBlockingErrors,
	resolveScreenshotRunStatus,
	resolveScreenshotBaseUrl,
	resolveScreenshotLaneContext,
	resolveUrl,
	getViewportProfileSummary,
	intersectRectWithViewport,
	redactScreenshotText,
	redactScreenshotUrl,
	redactScreenshotPlan,
	buildScreenshotPath,
} from '../../../scripts/screenshot/utils';
import type { ScreenshotRunReport } from '../../../scripts/screenshot/types';

describe('screenshot CLI utilities', () => {
	it('defaults direct captures to audit mode unless raw is requested', () => {
		expect(parseCliArgs(['node', 'cli.ts', '--url=/']).mode).toBeUndefined();
		expect(parseCliArgs(['node', 'cli.ts', '--url=/', '--mode=raw']).mode).toBe('raw');
		expect(parseCliArgs(['node', 'cli.ts', '--url=/', '--mode=audit']).mode).toBe('audit');
	});

	it('rejects unknown CLI arguments instead of silently entering interactive mode', () => {
		expect(() => parseCliArgs(['node', 'cli.ts', '--not-a-real-flag'])).toThrow(
			/Unknown screenshot argument/,
		);
	});

	it('redacts query values and credentials from screenshot diagnostics', () => {
		expect(redactScreenshotUrl('/xv/demo?guest=ana&screenshot=1')).toBe('/xv/demo');
		expect(redactScreenshotText('GET https://example.test/x?token=secret')).toBe(
			'GET https://example.test/x',
		);
		const redacted = redactScreenshotPlan({
			sourceRequest: { routes: ['/xv/demo?guest=ana'] },
		} as never) as unknown as { sourceRequest: { routes: string[] } };
		expect(redacted.sourceRequest.routes).toEqual(['/xv/demo']);
	});

	it('rejects unsafe artifact names before creating capture directories', async () => {
		await expect(
			buildScreenshotPath('screenshots', 'mobile-standard', '../private', 'png'),
		).rejects.toThrow(/Unsafe screenshot artifact name/);
	});

	it('deduplicates explicit viewport names and rejects invalid values', () => {
		expect(
			resolveViewports('site', ['mobile-standard', 'mobile-standard', 'desktop']).map(
				(viewport) => viewport.name,
			),
		).toEqual(['mobile-standard', 'desktop']);
		expect(() => resolveViewports('site', ['not-a-viewport'])).toThrow(/Unknown viewport/);
	});

	it('marks incomplete execution as partial when requested work also succeeded', () => {
		expect(resolveScreenshotRunStatus({ failed: 1, succeeded: 2, warnings: 0 })).toBe(
			'partial',
		);
		expect(resolveScreenshotRunStatus({ failed: 1, succeeded: 0, warnings: 0 })).toBe('failed');
		expect(resolveScreenshotRunStatus({ failed: 0, succeeded: 2, warnings: 1 })).toBe(
			'warning',
		);
	});

	it('parses --section-extent for full and viewport framing', () => {
		expect(parseCliArgs(['node', 'cli.ts', '--section-extent=full']).sectionExtent).toBe(
			'full',
		);
		expect(parseCliArgs(['node', 'cli.ts', '--section-extent', 'viewport']).sectionExtent).toBe(
			'viewport',
		);
		expect(() => parseCliArgs(['node', 'cli.ts', '--section-extent=invalid'])).toThrow(
			/Invalid section extent/,
		);
	});

	it('intersects element boxes with the viewport for viewport-crop framing', () => {
		const viewport = { width: 390, height: 844 };

		expect(
			intersectRectWithViewport({ x: 0, y: 0, width: 390, height: 2000 }, viewport),
		).toEqual({ x: 0, y: 0, width: 390, height: 844 });

		expect(
			intersectRectWithViewport({ x: 10, y: 100, width: 370, height: 400 }, viewport),
		).toEqual({ x: 10, y: 100, width: 370, height: 400 });

		expect(
			intersectRectWithViewport({ x: 0, y: 900, width: 390, height: 200 }, viewport),
		).toBeNull();

		// 100vh section 1px taller than viewport — clamp so page.screenshot accepts clip
		expect(
			intersectRectWithViewport(
				{ x: 0, y: 0, width: 360, height: 741 },
				{ width: 360, height: 740 },
			),
		).toEqual({ x: 0, y: 0, width: 360, height: 740 });
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

	it('builds current-run manifests without counting stale output files', () => {
		const [mobileNarrow, desktop] = resolveViewports('site', ['mobile-narrow', 'desktop']);
		const manifest = buildCurrentRunManifest({
			viewports: [mobileNarrow, desktop],
			perViewportPlanned: { 'mobile-narrow': 3, desktop: 3 },
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

	it('provides default audit overlay selectors for consent and operational toolbars', () => {
		expect(getDefaultHideSelectors()).toContain('[data-consent-banner]');
		expect(getDefaultHideSelectors()).toContain('[aria-label*="cookie" i]');
		expect(getDefaultHideSelectors()).toEqual(
			expect.arrayContaining(getOperationalToolbarSelectors()),
		);
		expect(getOperationalToolbarSelectors()).toContain('astro-dev-toolbar');
		expect(getOperationalToolbarSelectors()).toContain('#vercel-live-feedback');
		expect(getOperationalToolbarSelectors()).toContain('[data-vercel-toolbar]');
	});

	it('deduplicates identical run-level notices while preserving unique ones', () => {
		expect(
			dedupeScreenshotNotices([
				'Audit normalization: overlays',
				'Audit normalization: overlays',
				'Optional capture omitted: letter',
				'Audit normalization: overlays',
			]),
		).toEqual(['Audit normalization: overlays', 'Optional capture omitted: letter']);
	});

	it('computes blocking errors without conflating successful captures', () => {
		expect(
			computeScreenshotBlockingErrors({
				captureFailed: 0,
				validationFailed: 0,
				manifestFailed: 3,
			}),
		).toBe(3);
		expect(
			computeScreenshotBlockingErrors({
				captureFailed: 0,
				validationFailed: 0,
				manifestFailed: 0,
			}),
		).toBe(0);
	});

	it('resolves screenshot base URL from the worktree lane port table', () => {
		expect(
			resolveScreenshotLaneContext({
				cwd: 'C:/repos/celebra-me-worktrees/dev-extra',
			}),
		).toMatchObject({
			laneId: 'dev-extra',
			port: 4322,
			baseUrl: 'http://localhost:4322',
			portSource: 'lane',
		});
		expect(resolveScreenshotBaseUrl({ cwd: 'C:/repos/celebra-me-worktrees/dev-local' })).toBe(
			'http://localhost:4321',
		);
		expect(resolveScreenshotBaseUrl({ cwd: 'C:/repos/celebra-me-worktrees/dev-preview' })).toBe(
			'http://localhost:4323',
		);
		expect(resolveScreenshotBaseUrl({ cwd: 'C:/repos/celebra-me' })).toBe(
			'http://localhost:4321',
		);

		// Unix checkout root: lane detection is platform-agnostic (marker-based).
		expect(resolveScreenshotBaseUrl({ cwd: '/home/dev/celebra-me-worktrees/dev-preview' })).toBe(
			'http://localhost:4323',
		);
	});

	it('lets ASTRO_PORT and explicit base URL override the lane table', () => {
		expect(
			resolveScreenshotLaneContext({
				cwd: 'C:/repos/celebra-me-worktrees/dev-extra',
				env: { ASTRO_PORT: '4390' },
			}),
		).toMatchObject({
			port: 4390,
			baseUrl: 'http://localhost:4390',
			portSource: 'astro-port',
		});
		expect(
			resolveScreenshotLaneContext({
				cwd: 'C:/repos/celebra-me-worktrees/dev-extra',
				explicitBaseUrl: 'http://127.0.0.1:9999/',
			}),
		).toMatchObject({
			baseUrl: 'http://127.0.0.1:9999',
			portSource: 'explicit',
		});
	});

	it('passes manifest when all required tasks succeed even if optional files also exist', () => {
		const [mobileNarrow] = resolveViewports('invitation', ['mobile-narrow']);
		const manifest = buildCurrentRunManifest({
			viewports: [mobileNarrow],
			perViewportPlanned: { 'mobile-narrow': 11 },
			target: 'critical-qa',
			perViewportPlannedTasks: {
				'mobile-narrow': [
					{ id: '01-initial-closed-viewport', required: true },
					{ id: '02-reveal-closed', required: false },
					{ id: '03-reveal-letter-open', required: false },
					{ id: '04-reveal-transition-open', required: false },
					{ id: '10-01-hero', required: true },
					{ id: '05-invitation-full-page', required: true },
				],
			},
			captures: [
				{
					id: '01-initial-closed-viewport',
					path: 'a/01.png',
					viewportName: 'mobile-narrow',
					label: 'Initial',
					success: true,
				},
				{
					id: '02-reveal-closed',
					path: 'a/02.png',
					viewportName: 'mobile-narrow',
					label: 'Closed',
					success: true,
					isOptional: true,
				},
				{
					id: '03-reveal-letter-open',
					path: 'a/03.png',
					viewportName: 'mobile-narrow',
					label: 'Letter',
					success: true,
					isOptional: true,
				},
				{
					id: '04-reveal-transition-open',
					path: 'a/04.png',
					viewportName: 'mobile-narrow',
					label: 'Transition',
					success: true,
					isOptional: true,
				},
				{
					id: '10-01-hero',
					path: 'a/10-01-hero.png',
					viewportName: 'mobile-narrow',
					label: 'Hero',
					success: true,
				},
				{
					id: '05-invitation-full-page',
					path: 'a/05.png',
					viewportName: 'mobile-narrow',
					label: 'Full',
					success: true,
				},
			],
		});

		expect(manifest[0].status).toBe('passed');
		expect(manifest[0].expected).toBe(3);
		expect(manifest[0].files).toBe(6);
		expect(manifest[0].requiredExpected).toBe(3);
		expect(manifest[0].requiredVerified).toBe(3);
		expect(manifest[0].optionalGenerated).toBe(3);
		expect(manifest[0].missingRequiredTaskIds).toEqual([]);
	});

	it('fails manifest only when required planned task ids are missing', () => {
		const [mobileNarrow] = resolveViewports('invitation', ['mobile-narrow']);
		const manifest = buildCurrentRunManifest({
			viewports: [mobileNarrow],
			perViewportPlanned: { 'mobile-narrow': 2 },
			target: 'critical-qa',
			perViewportPlannedTasks: {
				'mobile-narrow': [
					{ id: '01-initial-closed-viewport', required: true },
					{ id: '05-invitation-full-page', required: true },
					{ id: '02-reveal-closed', required: false },
				],
			},
			captures: [
				{
					id: '01-initial-closed-viewport',
					path: 'a/01.png',
					viewportName: 'mobile-narrow',
					label: 'Initial',
					success: true,
				},
				{
					id: '02-reveal-closed',
					path: 'a/02.png',
					viewportName: 'mobile-narrow',
					label: 'Closed',
					success: true,
					isOptional: true,
				},
			],
		});

		expect(manifest[0].status).toBe('failed');
		expect(manifest[0].missingRequiredTaskIds).toEqual(['05-invitation-full-page']);
		expect(manifest[0].optionalGenerated).toBe(1);
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

	it('fails manifest status when files generated are fewer than planned required files', () => {
		const [mobileNarrow] = resolveViewports('site', ['mobile-narrow']);
		const manifest = buildCurrentRunManifest({
			viewports: [mobileNarrow],
			perViewportPlanned: { 'mobile-narrow': 5 },
			target: 'critical-qa',
			captures: [
				{
					path: 'temp/screenshots/abril/mobile-narrow/01-initial.png',
					viewportName: 'mobile-narrow',
					label: 'Initial cover',
					success: true,
				},
				{
					path: 'temp/screenshots/abril/mobile-narrow/02-reveal.png',
					viewportName: 'mobile-narrow',
					label: 'Reveal cover',
					success: true,
				},
				{
					path: 'temp/screenshots/abril/mobile-narrow/05-full-open.png',
					viewportName: 'mobile-narrow',
					label: 'Full invitation',
					success: true,
				},
			],
		});

		expect(manifest[0]).toEqual({
			name: 'mobile-narrow',
			files: 3,
			expected: 5,
			status: 'failed',
		});
	});

	describe('resolveUrl', () => {
		const base = 'http://localhost:4321';

		it('passes absolute http(s) URLs through untouched', () => {
			expect(resolveUrl('https://www.celebra-me.com/boda/x', base)).toBe(
				'https://www.celebra-me.com/boda/x',
			);
			expect(resolveUrl('http://127.0.0.1:4390/dashboard', base)).toBe(
				'http://127.0.0.1:4390/dashboard',
			);
		});

		it('joins routes that intentionally begin with a slash', () => {
			expect(resolveUrl('/boda/demo-boda-jewelry-box-wedding', base)).toBe(
				'http://localhost:4321/boda/demo-boda-jewelry-box-wedding',
			);
			expect(resolveUrl('/', base)).toBe('http://localhost:4321/');
		});

		it('normalizes relative application routes to a leading slash', () => {
			expect(resolveUrl('boda/demo-xv-editorial', base)).toBe(
				'http://localhost:4321/boda/demo-xv-editorial',
			);
		});

		it('recovers Git for Windows conversion (C:/Program Files/Git prefix)', () => {
			expect(resolveUrl('C:/Program Files/Git/boda/demo-boda-jewelry-box-wedding', base)).toBe(
				'http://localhost:4321/boda/demo-boda-jewelry-box-wedding',
			);
		});

		it('recovers MSYS2 conversion (C:/msys64 prefix)', () => {
			expect(resolveUrl('C:/msys64/boda/demo-xv-editorial', base)).toBe(
				'http://localhost:4321/boda/demo-xv-editorial',
			);
		});

		it('recovers Scoop Git conversion (C:/Users/<u>/scoop/apps/git/current prefix)', () => {
			expect(
				resolveUrl(
					'C:/Users/someone/scoop/apps/git/current/boda/demo-xv-enchanted-rose',
					base,
				),
			).toBe('http://localhost:4321/boda/demo-xv-enchanted-rose');
		});

		it('recovers converted /c/Users/... arguments', () => {
			expect(resolveUrl('C:/Users/someone/boda/demo-xv-editorial', base)).toBe(
				'http://localhost:4321/boda/demo-xv-editorial',
			);
		});

		it('does not strip arbitrary Windows path prefixes', () => {
			expect(resolveUrl('C:/Some Other/dir/route', base)).toBe(
				'http://localhost:4321/C:/Some Other/dir/route',
			);
		});

		it('keeps query strings intact after prefix stripping', () => {
			expect(resolveUrl('C:/Program Files/Git/boda/x?tab=1', base)).toBe(
				'http://localhost:4321/boda/x?tab=1',
			);
		});
	});
});
