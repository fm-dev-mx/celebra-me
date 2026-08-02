import {
	assertScreenshotExecutionBudget,
	summarizeScreenshotPlans,
} from '../../../scripts/screenshot/execution-policy';
import type { ResolvedScreenshotPlan } from '../../../scripts/screenshot/scope';

function plan(page: number): ResolvedScreenshotPlan {
	return {
		version: 1,
		source: 'config',
		sourceRequest: {},
		pageType: 'landing',
		invitations: [
			{
				route: `/${page}`,
				url: `http://localhost:4322/${page}`,
				pageType: 'landing',
				routeIdentity: { pathname: `/${page}`, query: '', key: `/${page}` },
				target: 'full-page',
				sectionSelection: { kind: 'ids', ids: [] },
				includeLayout: false,
				viewportProfile: 'single',
				viewports: [
					{ name: 'mobile-standard', width: 390, height: 844, deviceScaleFactor: 2 },
				],
				outputDir: `screenshots/${page}`,
				tasks: [
					{
						id: '02-full-page',
						label: 'Full page',
						viewportName: 'mobile-standard',
						outputPath: `screenshots/${page}/mobile-standard/02-full-page.png`,
						required: true,
					},
				],
				cleanupTargets: [],
			},
		],
		viewports: [{ name: 'mobile-standard', width: 390, height: 844, deviceScaleFactor: 2 }],
		tasks: [],
		cleanupTargets: [],
		clean: false,
	};
}

describe('screenshot execution policy', () => {
	it('summarizes pages, invitations, viewports, and planned artifacts', () => {
		expect(summarizeScreenshotPlans([plan(1)])).toMatchObject({
			pages: 1,
			invitations: 1,
			viewports: 1,
			artifacts: 1,
		});
	});

	it('requires an explicit override for an oversized config batch', () => {
		const plans = Array.from({ length: 2 }, (_, index) => plan(index + 1));
		const summary = summarizeScreenshotPlans(plans);
		expect(() => assertScreenshotExecutionBudget(summary, { source: 'config' })).toThrow(
			/normal targeted budget/,
		);
		expect(() =>
			assertScreenshotExecutionBudget(summary, { source: 'config', allowLarge: true }),
		).not.toThrow();
	});
});
