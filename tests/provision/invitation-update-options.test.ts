import { describe, expect, it } from '@jest/globals';
import {
	assertContentOnlyAllowsNoAssetMutations,
	checkUnknownFlags,
	defaultAssetPolicy,
	parseCliUpdateScope,
	requireResolvedUpdateScope,
	resolveCliPruneAssets,
	resolvePromotionUpdateScope,
} from '../../scripts/provision/invitation-update-options.ts';

describe('parseCliUpdateScope', () => {
	it('returns undefined when the flag is omitted', () => {
		expect(parseCliUpdateScope(['--slug', 'leslie-perez'])).toBeUndefined();
	});

	it('parses an explicit --update-scope value', () => {
		expect(parseCliUpdateScope(['--update-scope', 'content-and-assets'])).toBe(
			'content-and-assets',
		);
		expect(parseCliUpdateScope(['--update-scope', 'content-only'])).toBe('content-only');
		expect(parseCliUpdateScope(['--update-scope', 'assets-only'])).toBe('assets-only');
	});

	it('treats --content-only as an explicit content-only override', () => {
		expect(parseCliUpdateScope(['--content-only'])).toBe('content-only');
	});

	it('rejects --content-only combined with --update-scope', () => {
		expect(() =>
			parseCliUpdateScope(['--content-only', '--update-scope', 'content-and-assets']),
		).toThrow(/UPDATE_SCOPE_CONFLICT/);
	});

	it('rejects an invalid --update-scope value', () => {
		expect(() => parseCliUpdateScope(['--update-scope', 'nope'])).toThrow(
			/UPDATE_SCOPE_INVALID/,
		);
	});

	it('rejects --update-scope without a value', () => {
		expect(() => parseCliUpdateScope(['--update-scope'])).toThrow(/UPDATE_SCOPE_INVALID/);
	});
});

describe('resolvePromotionUpdateScope', () => {
	it('prefers explicit updateScope over deliveryScope', () => {
		expect(
			resolvePromotionUpdateScope({
				updateScope: 'content-only',
				deliveryScope: 'content-and-assets',
			}),
		).toBe('content-only');
	});

	it('uses definition deliveryScope when updateScope is omitted', () => {
		expect(resolvePromotionUpdateScope({ deliveryScope: 'content-and-assets' })).toBe(
			'content-and-assets',
		);
		expect(resolvePromotionUpdateScope({ deliveryScope: 'content-only' })).toBe('content-only');
	});

	it('returns undefined when neither override nor deliveryScope is usable', () => {
		expect(resolvePromotionUpdateScope({})).toBeUndefined();
		expect(resolvePromotionUpdateScope({ deliveryScope: 'unknown' })).toBeUndefined();
	});
});

describe('requireResolvedUpdateScope', () => {
	it('returns the inherited deliveryScope', () => {
		expect(requireResolvedUpdateScope({ deliveryScope: 'content-and-assets' })).toBe(
			'content-and-assets',
		);
	});

	it('throws UPDATE_SCOPE_UNRESOLVED when nothing resolves', () => {
		expect(() => requireResolvedUpdateScope({})).toThrow(/UPDATE_SCOPE_UNRESOLVED/);
	});
});

describe('defaultAssetPolicy', () => {
	it('preserves assets for content-only and uploads missing otherwise', () => {
		expect(defaultAssetPolicy('content-only')).toBe('preserve');
		expect(defaultAssetPolicy('content-and-assets')).toBe('missing');
		expect(defaultAssetPolicy('assets-only')).toBe('missing');
	});
});

describe('assertContentOnlyAllowsNoAssetMutations', () => {
	it('allows content-only with zero asset mutations', () => {
		expect(() =>
			assertContentOnlyAllowsNoAssetMutations({
				updateScope: 'content-only',
				plannedAssetMutations: 0,
			}),
		).not.toThrow();
	});

	it('allows content-and-assets with planned uploads', () => {
		expect(() =>
			assertContentOnlyAllowsNoAssetMutations({
				updateScope: 'content-and-assets',
				plannedAssetMutations: 3,
			}),
		).not.toThrow();
	});

	it('fails closed when content-only plans asset mutations', () => {
		expect(() =>
			assertContentOnlyAllowsNoAssetMutations({
				updateScope: 'content-only',
				plannedAssetMutations: 1,
			}),
		).toThrow(/CONTENT_ONLY_ASSET_MUTATION/);
	});
});

describe('CLI inheritance happy paths', () => {
	it('omitted flag + content-and-assets definition resolves to missing policy', () => {
		const updateScope = requireResolvedUpdateScope({
			updateScope: parseCliUpdateScope([]),
			deliveryScope: 'content-and-assets',
		});
		expect(updateScope).toBe('content-and-assets');
		expect(defaultAssetPolicy(updateScope)).toBe('missing');
	});

	it('omitted flag + content-only definition resolves to preserve policy', () => {
		const updateScope = requireResolvedUpdateScope({
			updateScope: parseCliUpdateScope([]),
			deliveryScope: 'content-only',
		});
		expect(updateScope).toBe('content-only');
		expect(defaultAssetPolicy(updateScope)).toBe('preserve');
	});

	it('explicit --update-scope content-only overrides content-and-assets', () => {
		expect(
			requireResolvedUpdateScope({
				updateScope: parseCliUpdateScope(['--update-scope', 'content-only']),
				deliveryScope: 'content-and-assets',
			}),
		).toBe('content-only');
	});

	it('--content-only alone overrides content-and-assets', () => {
		expect(
			requireResolvedUpdateScope({
				updateScope: parseCliUpdateScope(['--content-only']),
				deliveryScope: 'content-and-assets',
			}),
		).toBe('content-only');
	});

	it('resolves pruneAssets default to true for content-and-assets unless --no-prune-assets is passed', () => {
		expect(resolveCliPruneAssets([], 'content-and-assets')).toBe(true);
		expect(resolveCliPruneAssets(['--no-prune-assets'], 'content-and-assets')).toBe(false);
		expect(resolveCliPruneAssets(['--prune-assets'], 'content-only')).toBe(true);
		expect(resolveCliPruneAssets([], 'content-only')).toBe(false);
		expect(resolveCliPruneAssets([])).toBe(true);
	});

	it('permits both --prune-assets and --no-prune-assets in checkUnknownFlags', () => {
		expect(() => checkUnknownFlags(['--prune-assets'])).not.toThrow();
		expect(() => checkUnknownFlags(['--no-prune-assets'])).not.toThrow();
	});
});
