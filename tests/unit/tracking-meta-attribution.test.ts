import {
	buildFbcFromFbclid,
	createMetaAttributionSnapshot,
	sanitizeMetaAttribution,
} from '@/lib/tracking/meta-attribution';

describe('meta attribution helpers', () => {
	it('sanitizes fbp, fbc, and fbclid while dropping malformed values', () => {
		expect(
			sanitizeMetaAttribution({
				fbp: ' fb.1.1710000000000.1234567890 ',
				fbc: 'fb.1.1710000000000.AbCd-123_456',
				fbclid: 'AbCd-123_456',
			}),
		).toEqual({
			fbp: 'fb.1.1710000000000.1234567890',
			fbc: 'fb.1.1710000000000.AbCd-123_456',
			fbclid: 'AbCd-123_456',
		});

		expect(
			sanitizeMetaAttribution({
				fbp: 'not-valid',
				fbc: 'fb.1.nope.bad',
				fbclid: 'bad value with spaces',
			}),
		).toEqual({});
	});

	it('derives fbc from fbclid when no fbc cookie is present', () => {
		expect(buildFbcFromFbclid('AbCd-123_456', 1710000000000)).toBe(
			'fb.1.1710000000000.AbCd-123_456',
		);
		expect(buildFbcFromFbclid('', 1710000000000)).toBeUndefined();
	});

	it('creates a snapshot only when the route policy allows Meta attribution', () => {
		expect(
			createMetaAttributionSnapshot({
				url: new URL('https://www.celebra-me.com/?fbclid=Click-123'),
				cookie: ' _fbp=fb.1.1710000000000.1234567890 ',
				now: 1710000000000,
			}),
		).toEqual({
			fbp: 'fb.1.1710000000000.1234567890',
			fbc: 'fb.1.1710000000000.Click-123',
			fbclid: 'Click-123',
		});

		expect(
			createMetaAttributionSnapshot({
				url: new URL('https://www.celebra-me.com/xv/valentina-hernandez?fbclid=Click-123'),
				cookie: '_fbp=fb.1.1710000000000.1234567890',
				now: 1710000000000,
			}),
		).toEqual({});
	});
});
