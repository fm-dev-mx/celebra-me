jest.mock('@/lib/tracking/meta-pixel-env', () => ({
	getPixelIdFromEnv: () => 'pixel-123',
	isPixelEnabledInEnv: () => true,
}));

import { createHash } from 'node:crypto';
import { normalizeAndHashPhone } from '@/lib/commercial/meta-capi/service';
import { META_PHONE_MATCH_STORAGE_KEY, saveConsent } from '@/lib/tracking/consent-client';
import {
	hashPhoneForMeta,
	initMetaPixel,
	PHONE_MATCH_TTL_MS,
	readMetaPhoneMatchKey,
	rememberMetaPhoneMatchKey,
} from '@/lib/tracking/meta-pixel';

const NOW = Date.UTC(2026, 9, 26, 12);
const PHONE_HASH = createHash('sha256').update('526561234567').digest('hex');

beforeEach(() => {
	localStorage.clear();
	jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('hashPhoneForMeta', () => {
	it('hashes the E.164 digits with the Mexico code added to a 10-digit number', () => {
		expect(hashPhoneForMeta('656 123 4567')).toBe(PHONE_HASH);
		expect(hashPhoneForMeta('+52 (656) 123-4567')).toBe(PHONE_HASH);
	});

	it('matches the hash the Conversions API sends for the stored phone_e164', () => {
		expect(hashPhoneForMeta('6561234567')).toBe(normalizeAndHashPhone('+526561234567'));
		expect(hashPhoneForMeta('+1 915 555 0100')).toBe(normalizeAndHashPhone('+19155550100'));
	});

	it('returns nothing for a number that is not a usable phone', () => {
		expect(hashPhoneForMeta('12345')).toBeUndefined();
		expect(hashPhoneForMeta('')).toBeUndefined();
	});
});

describe('Meta phone match key storage', () => {
	it('stores only the hash, with an expiry, when marketing consent is granted', () => {
		saveConsent(true, true);
		rememberMetaPhoneMatchKey('6561234567', NOW);

		const raw = localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY) ?? '';
		expect(raw).not.toContain('6561234567');
		expect(JSON.parse(raw)).toEqual({ ph: PHONE_HASH, expiresAt: NOW + PHONE_MATCH_TTL_MS });
		expect(readMetaPhoneMatchKey(NOW + 1000)).toBe(PHONE_HASH);
	});

	it('stores nothing without marketing consent', () => {
		saveConsent(true, false);
		rememberMetaPhoneMatchKey('6561234567', NOW);
		expect(localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY)).toBeNull();
	});

	it('deletes an expired hash when it is read', () => {
		saveConsent(true, true);
		rememberMetaPhoneMatchKey('6561234567', NOW);
		expect(readMetaPhoneMatchKey(NOW + PHONE_MATCH_TTL_MS)).toBeUndefined();
		expect(localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY)).toBeNull();
	});

	it('deletes the hash when marketing consent is withdrawn', () => {
		saveConsent(true, true);
		rememberMetaPhoneMatchKey('6561234567', NOW);
		saveConsent(true, false);
		expect(localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY)).toBeNull();
	});

	it('ignores and deletes a stored value read without consent or in a bad shape', () => {
		localStorage.setItem(
			META_PHONE_MATCH_STORAGE_KEY,
			JSON.stringify({ ph: PHONE_HASH, expiresAt: NOW + 1000 }),
		);
		expect(readMetaPhoneMatchKey(NOW)).toBeUndefined();
		expect(localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY)).toBeNull();

		saveConsent(true, true);
		localStorage.setItem(
			META_PHONE_MATCH_STORAGE_KEY,
			JSON.stringify({ ph: '6561234567', expiresAt: NOW + 1000 }),
		);
		expect(readMetaPhoneMatchKey(NOW)).toBeUndefined();
		expect(localStorage.getItem(META_PHONE_MATCH_STORAGE_KEY)).toBeNull();
	});
});

describe('Meta Pixel initialization', () => {
	it('sends the stored hashed phone as ph next to external_id', () => {
		saveConsent(true, true);
		localStorage.setItem('cm_visitor_id', 'visitor_123456');
		rememberMetaPhoneMatchKey('6561234567');
		document.body.dataset.trackingRouteClass = 'commercial';

		initMetaPixel();
		const script = document.querySelector<HTMLScriptElement>('script[src*="fbevents.js"]');
		script?.onload?.(new Event('load'));

		expect(window.fbq.queue).toContainEqual(['set', 'autoConfig', false, 'pixel-123']);
		expect(window.fbq.queue).toContainEqual([
			'init',
			'pixel-123',
			{ external_id: expect.stringMatching(/^[0-9a-f]{64}$/), ph: PHONE_HASH },
		]);
	});
});
