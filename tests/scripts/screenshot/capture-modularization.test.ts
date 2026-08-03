import {
	buildScreenshotUrl,
	compositeSectionCapturePngs,
	createRevealOcclusionCache,
	evaluateRevealIsOpen,
	hideFixedOverlaysForCapture,
	launchBrowser,
	prepareAuditPage,
	probeFirstMatchingSelectors,
	resolveCapturePlan,
	captureInvitationScreenshots,
	captureGeneralPageScreenshots,
	planDocumentCaptureStrips,
	shouldSkipInvitationOpenCapture,
	assertCapturePlanScopeOwnership,
} from '../../../scripts/screenshot/capture';
import type { ScreenshotJob } from '../../../scripts/screenshot/types';

function invitationFullPageJob(): ScreenshotJob {
	return {
		pageType: 'invitation',
		mode: 'audit',
		url: 'http://localhost:4322/xv/demo',
		baseUrl: 'http://localhost:4322',
		viewportProfile: 'invitation',
		viewports: [],
		target: 'full-page',
		revealHandling: 'auto',
		animationHandling: 'disable',
		sectionExtent: 'full',
		includeLayout: false,
		outputFormat: 'png',
		criticalSelectors: [],
		hideSelectors: [],
	} as unknown as ScreenshotJob;
}

describe('screenshot capture modularization contracts', () => {
	it('keeps key public symbols importable from the capture facade', () => {
		expect(typeof launchBrowser).toBe('function');
		expect(typeof resolveCapturePlan).toBe('function');
		expect(typeof captureInvitationScreenshots).toBe('function');
		expect(typeof captureGeneralPageScreenshots).toBe('function');
		expect(typeof compositeSectionCapturePngs).toBe('function');
		expect(typeof planDocumentCaptureStrips).toBe('function');
		expect(typeof prepareAuditPage).toBe('function');
		expect(typeof hideFixedOverlaysForCapture).toBe('function');
		expect(typeof createRevealOcclusionCache).toBe('function');
		expect(typeof probeFirstMatchingSelectors).toBe('function');
		expect(typeof evaluateRevealIsOpen).toBe('function');
		expect(typeof shouldSkipInvitationOpenCapture).toBe('function');
		expect(typeof assertCapturePlanScopeOwnership).toBe('function');
		expect(typeof buildScreenshotUrl).toBe('function');
	});

	it('reuses precomputed reveal capabilities and avoids a second detect (E1)', async () => {
		let evaluateCalls = 0;
		const page = {
			locator: () => ({
				count: async () => 0,
				first: () => ({ isVisible: async () => false }),
			}),
			evaluate: async () => {
				evaluateCalls += 1;
				return {
					hasReveal: false,
					revealType: 'none',
					hasLetter: false,
					hasFlapTransition: false,
				};
			},
		};

		const capabilities = {
			hasReveal: true,
			revealType: 'envelope' as const,
			hasLetter: true,
			hasFlapTransition: true,
		};

		const tasks = await resolveCapturePlan(page as never, invitationFullPageJob(), {
			revealCapabilities: capabilities,
		});
		expect(evaluateCalls).toBe(0);
		expect(tasks.some((t) => t.id === '05-invitation-full-page')).toBe(true);
	});

	it('still detects reveal capabilities when planner is called standalone (E1)', async () => {
		let evaluateCalls = 0;
		const page = {
			locator: () => ({
				count: async () => 0,
				first: () => ({ isVisible: async () => false }),
			}),
			evaluate: async () => {
				evaluateCalls += 1;
				return {
					hasReveal: true,
					revealType: 'envelope',
					hasLetter: true,
					hasFlapTransition: true,
				};
			},
		};

		await resolveCapturePlan(page as never, invitationFullPageJob());
		expect(evaluateCalls).toBeGreaterThan(0);
	});

	it('reuses occlusion validation only while navigation URL is unchanged (E2)', async () => {
		let evaluateCalls = 0;
		const page = {
			url: () => 'http://localhost:4322/xv/demo?screenshot=1&reveal=open',
			evaluate: async () => {
				evaluateCalls += 1;
				return {
					present: true,
					hidden: true,
					display: 'none',
					visibility: 'hidden',
					opacity: 0,
					width: 0,
					height: 0,
					intersectsViewport: false,
				};
			},
		};

		const cache = createRevealOcclusionCache();
		await expect(cache.assert(page as never)).resolves.toBe(true);
		await expect(cache.assert(page as never)).resolves.toBe(true);
		expect(evaluateCalls).toBe(1);

		page.url = () =>
			'http://localhost:4322/xv/demo?screenshot=1&reveal=letter&forceEnvelope=true';
		await expect(cache.assert(page as never)).resolves.toBe(true);
		expect(evaluateCalls).toBe(2);

		cache.invalidate();
		expect(cache.getCached()).toBeNull();
	});

	it('skips overlay settle timeout when hide state is already active (E3)', async () => {
		const waits: number[] = [];
		const page = {
			evaluate: jest
				.fn()
				.mockResolvedValueOnce({ alreadyInjected: true, alreadyActive: true })
				.mockResolvedValue(undefined),
			addStyleTag: jest.fn(),
			waitForTimeout: jest.fn(async (ms: number) => {
				waits.push(ms);
			}),
		};

		const restore = await hideFixedOverlaysForCapture(page as never);
		expect(waits).toEqual([]);
		expect(page.addStyleTag).not.toHaveBeenCalled();

		await restore();
		expect(page.evaluate).toHaveBeenCalled();
	});

	it('settles overlays only when transitioning into the hidden state (E3)', async () => {
		const waits: number[] = [];
		const page = {
			evaluate: jest
				.fn()
				.mockResolvedValueOnce({ alreadyInjected: true, alreadyActive: false })
				.mockResolvedValue(undefined),
			addStyleTag: jest.fn(),
			waitForTimeout: jest.fn(async (ms: number) => {
				waits.push(ms);
			}),
		};

		await hideFixedOverlaysForCapture(page as never);
		expect(waits).toEqual([50]);
	});

	it('does not duplicate layout stabilization after a full lazy-scroll pass (E4)', async () => {
		let lazyFlagReads = 0;
		const page = {
			evaluate: jest.fn(async (fn: unknown) => {
				if (typeof fn === 'function') {
					const src = String(fn);
					if (src.includes('screenshotLazyScrolled')) {
						lazyFlagReads += 1;
						// First read: not yet scrolled → full lazy path runs and stabilizes.
						return false;
					}
				}
				return undefined;
			}),
			waitForLoadState: jest.fn(async () => undefined),
			waitForTimeout: jest.fn(async () => undefined),
			waitForFunction: jest.fn(async () => true),
			addStyleTag: jest.fn(async () => undefined),
		};

		await prepareAuditPage(page as never, [], [], { skipLazyScroll: false });
		expect(lazyFlagReads).toBeGreaterThan(0);
		// Full lazy path stabilizes once; prepareAuditPage must not add a second call.
		expect(page.waitForFunction).toHaveBeenCalledTimes(1);
	});

	it('still stabilizes layout when lazy scroll is skipped (E4)', async () => {
		const page = {
			evaluate: jest.fn(async () => undefined),
			waitForLoadState: jest.fn(async () => undefined),
			waitForTimeout: jest.fn(async () => undefined),
			waitForFunction: jest.fn(async () => true),
			addStyleTag: jest.fn(async () => undefined),
		};

		await prepareAuditPage(page as never, [], [], { skipLazyScroll: true });
		expect(page.waitForFunction).toHaveBeenCalledTimes(1);
	});

	it('still stabilizes once when lazy scroll short-circuits as already scrolled (E4)', async () => {
		const page = {
			evaluate: jest.fn(async (fn: unknown) => {
				if (typeof fn === 'function' && String(fn).includes('screenshotLazyScrolled')) {
					return true;
				}
				return undefined;
			}),
			waitForLoadState: jest.fn(async () => undefined),
			waitForTimeout: jest.fn(async () => undefined),
			waitForFunction: jest.fn(async () => true),
			addStyleTag: jest.fn(async () => undefined),
		};

		await prepareAuditPage(page as never, [], [], { skipLazyScroll: false });
		expect(page.waitForFunction).toHaveBeenCalledTimes(1);
	});

	it('batches selector existence probes while preserving fallback order (E5)', async () => {
		const evaluate = jest.fn(
			async (_fn: unknown, probes: Array<{ id: string; selectors: string[] }>) => {
				expect(probes).toEqual([
					{ id: 'a', selectors: ['.missing', '.fallback-a', '.other'] },
					{ id: 'b', selectors: ['.present-b'] },
				]);
				return { a: '.fallback-a', b: '.present-b' };
			},
		);

		const page = { evaluate };
		const matches = await probeFirstMatchingSelectors(page as never, [
			{ id: 'a', selectors: ['.missing', '.fallback-a', '.other'] },
			{ id: 'b', selectors: ['.present-b'] },
		]);

		expect(evaluate).toHaveBeenCalledTimes(1);
		expect(matches).toEqual({ a: '.fallback-a', b: '.present-b' });
	});

	it('preserves general all-sections task order using batched matches (E5)', async () => {
		const job = {
			pageType: 'landing',
			mode: 'audit',
			url: 'http://localhost:4322/',
			baseUrl: 'http://localhost:4322',
			viewportProfile: 'site',
			viewports: [],
			target: 'all-sections',
			revealHandling: 'skip',
			animationHandling: 'disable',
			sectionExtent: 'full',
			includeLayout: false,
			outputFormat: 'png',
			criticalSelectors: [],
			hideSelectors: [],
		} as unknown as ScreenshotJob;

		const page = {
			evaluate: async (_fn: unknown, probes?: Array<{ id: string; selectors: string[] }>) => {
				if (!probes) return {};
				const out: Record<string, string | null> = {};
				for (const probe of probes) {
					// Match only the primary selector for the first probe; second uses fallback.
					out[probe.id] = probe.selectors[probe.selectors.length > 1 ? 1 : 0] ?? null;
					if (probe.selectors[0]?.includes('nonexistent')) {
						out[probe.id] = probe.selectors[1] ?? null;
					}
				}
				// Keep deterministic: return first selector for each known section id present in DOM.
				for (const probe of probes) {
					out[probe.id] = probe.selectors[0] ?? null;
				}
				return out;
			},
			locator: () => ({ count: async () => 1 }),
		};

		const tasks = await resolveCapturePlan(page as never, job);
		expect(tasks.length).toBeGreaterThan(0);
		expect(tasks.every((t) => t.type === 'section')).toBe(true);
		// Ordering must be stable ascending by planned index prefix.
		const ids = tasks.map((t) => t.id);
		expect([...ids].sort()).toEqual(ids);
	});
});
