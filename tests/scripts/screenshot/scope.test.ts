import path from 'node:path';
import {
	normalizeRouteIdentity,
	resolveScreenshotPlan,
	ScreenshotScopeError,
} from '../../../scripts/screenshot/scope';
import { KNOWN_SECTIONS } from '../../../scripts/screenshot/types';

const catalog = { invitationRoutes: ['/xv/demo-invitation'] };

function request(overrides: Record<string, unknown> = {}) {
	return {
		source: 'direct' as const,
		pageType: 'invitation' as const,
		baseUrl: 'http://localhost:4322',
		routes: ['/xv/demo-invitation'],
		profile: 'invitation' as const,
		outputFolderStyle: 'custom' as const,
		outputFolder: 'tmp/scope-plan',
		...overrides,
	};
}

describe('canonical screenshot scope resolver', () => {
	it('maps legacy sets to explicit targets and plans full-page artifacts exactly', () => {
		const plan = resolveScreenshotPlan(request({ invitationSet: 'full-page' }), catalog);
		const invitation = plan.invitations[0];

		expect(invitation.target).toBe('full-page');
		expect(invitation.sectionSelection).toEqual({ kind: 'ids', ids: [] });
		expect(invitation.viewports.map((viewport) => viewport.name)).toEqual([
			'mobile-narrow',
			'mobile-standard',
			'mobile-large',
		]);
		expect(invitation.tasks.map((task) => task.id)).toEqual([
			'01-initial-closed-viewport',
			'05-invitation-full-page',
			'01-initial-closed-viewport',
			'05-invitation-full-page',
			'01-initial-closed-viewport',
			'05-invitation-full-page',
		]);
		expect(invitation.tasks[0].outputPath).toBe(
			path.join('tmp/scope-plan', 'mobile-narrow', '01-initial-closed-viewport.png'),
		);
	});

	it('resolves page-type-aware comma sections and stable viewport deduplication', () => {
		const plan = resolveScreenshotPlan(
			request({
				target: 'single-section',
				sections: 'hero,gallery,hero',
				viewports: ['mobile-standard,mobile-standard', 'mobile-narrow'],
			}),
			catalog,
		);
		const invitation = plan.invitations[0];

		expect(invitation.sectionSelection).toEqual({ kind: 'ids', ids: ['hero', 'gallery'] });
		expect(invitation.viewports.map((viewport) => viewport.name)).toEqual([
			'mobile-standard',
			'mobile-narrow',
		]);
		expect(invitation.tasks.map((task) => task.id)).toEqual([
			'06-section-hero',
			'06-section-gallery',
			'06-section-hero',
			'06-section-gallery',
		]);
	});

	it('rejects invalid viewports without falling back to profile defaults', () => {
		expect(() =>
			resolveScreenshotPlan(request({ viewports: ['not-a-viewport'] }), catalog),
		).toThrow(/Unknown viewport/);
	});

	it('rejects unknown sections and routes before execution', () => {
		expect(() =>
			resolveScreenshotPlan(
				request({ target: 'single-section', sections: 'hero,not-real' }),
				catalog,
			),
		).toThrow(/Unknown section/);
		expect(() =>
			resolveScreenshotPlan(request({ routes: ['/xv/other-invitation'] }), catalog),
		).toThrow(/Unknown invitation route/);
	});

	it('rejects duplicate route identities instead of expanding the target scope', () => {
		expect(() =>
			resolveScreenshotPlan(
				request({ routes: ['/xv/demo-invitation', '/xv/demo-invitation'] }),
				catalog,
			),
		).toThrow(/Duplicate route in screenshot scope/);
	});

	it('rejects corpus plus targeted scope options', () => {
		expect(() =>
			resolveScreenshotPlan(
				request({
					source: 'corpus',
					target: 'all-sections',
					targetedOptions: ['--viewport'],
				}),
				catalog,
			),
		).toThrow(/Corpus mode cannot be combined/);
	});

	it('keeps full-page coverage as a named page-level plan with no section coverage scope', () => {
		const plan = resolveScreenshotPlan(request({ target: 'full-page' }), catalog);
		const invitation = plan.invitations[0];

		expect(invitation.sectionSelection.kind).toBe('ids');
		expect(invitation.tasks.every((task) => !task.sectionId)).toBe(true);
		expect(plan.cleanupTargets).toEqual([
			path.join('tmp/scope-plan', 'mobile-narrow', '01-initial-closed-viewport.png'),
			path.join('tmp/scope-plan', 'mobile-narrow', '05-invitation-full-page.png'),
			path.join('tmp/scope-plan', 'mobile-standard', '01-initial-closed-viewport.png'),
			path.join('tmp/scope-plan', 'mobile-standard', '05-invitation-full-page.png'),
			path.join('tmp/scope-plan', 'mobile-large', '01-initial-closed-viewport.png'),
			path.join('tmp/scope-plan', 'mobile-large', '05-invitation-full-page.png'),
			path.join('tmp/scope-plan', 'mobile-narrow', '05-invitation-full-open.png'),
			path.join('tmp/scope-plan', 'mobile-standard', '05-invitation-full-open.png'),
			path.join('tmp/scope-plan', 'mobile-large', '05-invitation-full-open.png'),
			path.join('tmp/scope-plan', 'preflight.json'),
			path.join('tmp/scope-plan', 'report.json'),
		]);
	});

	it('derives invitation critical-qa cleanup section paths from runtime task naming', () => {
		const plan = resolveScreenshotPlan(request({ target: 'critical-qa' }), catalog);
		const invitation = plan.invitations[0];
		const sectionCleanups = invitation.cleanupTargets.filter((target) =>
			target.includes(path.join('mobile-narrow', '10-')),
		);
		expect(sectionCleanups).toEqual(
			KNOWN_SECTIONS.filter((section) => section.pageType === 'invitation').map(
				(section, index) =>
					path.join(
						'tmp/scope-plan',
						'mobile-narrow',
						`10-${String(index + 1).padStart(2, '0')}-${section.outputSlug}.png`,
					),
			),
		);
	});

	it('preserves invitation identity query parameters while ignoring harness parameters', () => {
		expect(
			normalizeRouteIdentity('/xv/demo-invitation?guest=ana&screenshot=1&reveal=open'),
		).toEqual({
			pathname: '/xv/demo-invitation',
			query: 'guest=ana',
			key: '/xv/demo-invitation?guest=ana',
		});
	});

	it('uses the same resolved scope shape for direct, config, and corpus sources', () => {
		const direct = resolveScreenshotPlan(
			request({ source: 'direct', target: 'all-sections' }),
			catalog,
		);
		const config = resolveScreenshotPlan(
			request({ source: 'config', target: 'all-sections' }),
			catalog,
		);
		const corpus = resolveScreenshotPlan(
			request({ source: 'corpus', target: 'all-sections' }),
			catalog,
		);
		const comparable = (plan: typeof direct) => ({
			invitations: plan.invitations.map((invitation) => ({
				routeIdentity: invitation.routeIdentity,
				target: invitation.target,
				sectionSelection: invitation.sectionSelection,
				viewports: invitation.viewports,
				tasks: invitation.tasks,
			})),
		});

		expect(comparable(direct)).toEqual(comparable(config));
		expect(comparable(direct)).toEqual(comparable(corpus));
	});

	it('uses a typed scope error for actionable validation failures', () => {
		try {
			resolveScreenshotPlan(request({ target: 'single-section' }), catalog);
			throw new Error('expected resolver to fail');
		} catch (error) {
			expect(error).toBeInstanceOf(ScreenshotScopeError);
			expect((error as ScreenshotScopeError).code).toBe('EMPTY_SECTION_SELECTION');
		}
	});
});
