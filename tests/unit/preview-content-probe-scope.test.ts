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

	it('keeps every case and viewport in the full scope', () => {
		const cases = buildVisualPageCases();
		const selected = selectContentProbeCases(cases, VISUAL_VIEWPORTS, 'all');
		expect(selected).toHaveLength(cases.length);
		expect(selected.every((item) => item.viewports.length === VISUAL_VIEWPORTS.length)).toBe(
			true,
		);
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

	it('covers every event type of the visual page cases', () => {
		const cases = buildVisualPageCases();
		const selected = selectContentProbeCases(cases, VISUAL_VIEWPORTS, 'event-types');
		expect(selected.map((item) => item.entry.eventType).sort()).toEqual(
			[...new Set(cases.map((entry) => entry.eventType))].sort(),
		);
	});
});
