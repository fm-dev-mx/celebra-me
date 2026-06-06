import {
	normalizeForPublication,
	stableStringify,
} from '@/lib/content-publication/normalize-content';
import { hashContent } from '@/lib/content-publication/hash-content';
import { diffContent } from '@/lib/content-publication/diff-content';
import { classifyDemoDriftStatus } from '@/lib/content-publication/drift-status';

describe('content publication utilities', () => {
	it('produces stable hashes when object keys are ordered differently', () => {
		const a = { title: 'Demo', hero: { date: '2026-01-01', name: 'Ana' } };
		const b = { hero: { name: 'Ana', date: '2026-01-01' }, title: 'Demo' };

		expect(stableStringify(normalizeForPublication(a))).toBe(
			stableStringify(normalizeForPublication(b)),
		);
		expect(hashContent(a)).toBe(hashContent(b));
	});

	it('keeps array order significant', () => {
		const a = { itinerary: [{ label: 'Misa' }, { label: 'Fiesta' }] };
		const b = { itinerary: [{ label: 'Fiesta' }, { label: 'Misa' }] };

		expect(hashContent(a)).not.toBe(hashContent(b));
		expect(diffContent(a, b).changedPaths).toEqual([
			'itinerary[0].label',
			'itinerary[1].label',
		]);
	});

	it('does not strip _assetSlug because it affects rendering', () => {
		const normalized = normalizeForPublication({
			title: 'Demo',
			_assetSlug: 'demo-xv-jewelry-box',
			optional: undefined,
		}) as Record<string, unknown>;

		expect(normalized._assetSlug).toBe('demo-xv-jewelry-box');
		expect(normalized).toHaveProperty('optional', null);
	});

	it('classifies honest v1 drift statuses', () => {
		expect(
			classifyDemoDriftStatus({
				hasLocal: true,
				hasProd: true,
				localValid: true,
				prodIsDemo: true,
				localHash: 'a',
				prodHash: 'a',
			}),
		).toBe('in_sync');
		expect(
			classifyDemoDriftStatus({
				hasLocal: true,
				hasProd: true,
				localValid: true,
				prodIsDemo: true,
				localHash: 'a',
				prodHash: 'b',
			}),
		).toBe('different');
		expect(classifyDemoDriftStatus({ hasLocal: false, hasProd: true, prodIsDemo: true })).toBe(
			'missing_locally',
		);
		expect(classifyDemoDriftStatus({ hasLocal: true, hasProd: false, localValid: true })).toBe(
			'missing_in_prod',
		);
		expect(classifyDemoDriftStatus({ hasLocal: true, hasProd: true, localValid: false })).toBe(
			'schema_mismatch',
		);
		expect(
			classifyDemoDriftStatus({
				hasLocal: true,
				hasProd: true,
				localValid: true,
				prodIsDemo: false,
			}),
		).toBe('unsafe_target');
	});
});
