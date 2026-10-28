import {
	resolveContentProbeScope,
	selectContentProbeCases,
} from '../e2e/preview/content-probe-scope';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
} from '../../scripts/screenshot/visual-coverage-contract';

describe('Preview content probe scope', () => {
	it('defaults to every case and rejects unknown scopes', () => {
		expect(resolveContentProbeScope(undefined)).toBe('all');
		expect(resolveContentProbeScope(' ')).toBe('all');
		expect(resolveContentProbeScope('event-types')).toBe('event-types');
		expect(() => resolveContentProbeScope('mobile')).toThrow('PREVIEW_CONTENT_PROBE');
	});

	it('excludes only the retired Preview copy while preserving all active cases in full scope', () => {
		const cases = buildVisualPageCases();
		const selected = selectContentProbeCases(cases, VISUAL_VIEWPORTS, 'all');
		const archived = { kind: 'invitation', eventType: 'boda', slug: 'daniela-y-martin' };

		expect(
			selected.some(
				(item) =>
					item.entry.kind === archived.kind &&
					item.entry.eventType === archived.eventType &&
					item.entry.slug === archived.slug,
			),
		).toBe(false);
		expect(selected).toHaveLength(cases.length - 1);
		expect(selected.every((item) => item.viewports.length === VISUAL_VIEWPORTS.length)).toBe(
			true,
		);
	});

	it('preserves every case including the retired Preview copy when scoped to production', () => {
		const cases = buildVisualPageCases();
		const selected = selectContentProbeCases(cases, VISUAL_VIEWPORTS, 'all', 'production');
		const archived = { kind: 'invitation', eventType: 'boda', slug: 'daniela-y-martin' };

		expect(selected).toHaveLength(cases.length);
		expect(
			selected.some(
				(item) =>
					item.entry.kind === archived.kind &&
					item.entry.eventType === archived.eventType &&
					item.entry.slug === archived.slug,
			),
		).toBe(true);
	});

	it('selects an active invitation for wedding instead of the retired Preview copy in event-types scope', () => {
		const cases = buildVisualPageCases();
		const previewSelected = selectContentProbeCases(
			cases,
			VISUAL_VIEWPORTS,
			'event-types',
			'preview',
		);
		const previewWedding = previewSelected.find((item) => item.entry.eventType === 'boda');
		expect(previewWedding).toBeDefined();
		expect(previewWedding?.entry.kind).toBe('invitation');
		expect(previewWedding?.entry.slug).not.toBe('daniela-y-martin');
		expect(previewWedding?.entry.slug).toBe('victoria-y-roberto');

		const prodSelected = selectContentProbeCases(
			cases,
			VISUAL_VIEWPORTS,
			'event-types',
			'production',
		);
		const prodWedding = prodSelected.find((item) => item.entry.eventType === 'boda');
		expect(prodWedding?.entry.slug).toBe('daniela-y-martin');
	});

	it('visits one case per event type at the first viewport, preferring real invitations', () => {
		const cases = [
			{ kind: 'demo' as const, eventType: 'xv', slug: 'demo-xv' },
			{ kind: 'invitation' as const, eventType: 'xv', slug: 'real-xv' },
			{ kind: 'invitation' as const, eventType: 'xv', slug: 'second-xv' },
			{ kind: 'demo' as const, eventType: 'bautizo', slug: 'demo-bautizo' },
		];
		const selected = selectContentProbeCases(cases, ['mobile', 'desktop'], 'event-types');
		expect(selected).toEqual([
			{ entry: cases[1], viewports: ['mobile'] },
			{ entry: cases[3], viewports: ['mobile'] },
		]);
	});

	it('excludes retired Preview copies in synthetic cases while allowing other invitations and demos', () => {
		const cases = [
			{ kind: 'invitation' as const, eventType: 'boda', slug: 'daniela-y-martin' },
			{ kind: 'demo' as const, eventType: 'boda', slug: 'demo-brisa' },
		];
		const previewSelected = selectContentProbeCases(
			cases,
			['mobile'],
			'event-types',
			'preview',
		);
		expect(previewSelected).toEqual([{ entry: cases[1], viewports: ['mobile'] }]);

		const prodSelected = selectContentProbeCases(
			cases,
			['mobile'],
			'event-types',
			'production',
		);
		expect(prodSelected).toEqual([{ entry: cases[0], viewports: ['mobile'] }]);
	});

	it('covers every event type of the visual page cases', () => {
		const cases = buildVisualPageCases();
		const selected = selectContentProbeCases(cases, VISUAL_VIEWPORTS, 'event-types');
		expect(selected.map((item) => item.entry.eventType).sort()).toEqual(
			[...new Set(cases.map((entry) => entry.eventType))].sort(),
		);
	});
});
