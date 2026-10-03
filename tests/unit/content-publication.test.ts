import {
	normalizeForPublication,
	stableStringify,
} from '@/lib/content-publication/normalize-content';

describe('content publication normalization', () => {
	it('serializes identically when object keys are ordered differently', () => {
		const a = { title: 'Demo', hero: { date: '2026-01-01', name: 'Ana' } };
		const b = { hero: { name: 'Ana', date: '2026-01-01' }, title: 'Demo' };

		expect(stableStringify(a)).toBe(stableStringify(b));
	});

	it('keeps array order significant', () => {
		const a = { itinerary: [{ label: 'Misa' }, { label: 'Fiesta' }] };
		const b = { itinerary: [{ label: 'Fiesta' }, { label: 'Misa' }] };

		expect(stableStringify(a)).not.toBe(stableStringify(b));
	});

	it('keeps _assetSlug and maps undefined to null', () => {
		const normalized = normalizeForPublication({
			title: 'Demo',
			_assetSlug: 'demo-xv-editorial',
			optional: undefined,
		}) as Record<string, unknown>;

		expect(normalized._assetSlug).toBe('demo-xv-editorial');
		expect(normalized).toHaveProperty('optional', null);
	});
});
