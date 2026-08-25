import {
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
	VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN,
	VALENTINA_MEMORIES_EVENT_ID,
	VALENTINA_MEMORIES_EVENT_TIME_ZONE,
	VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS,
	VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS,
	VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS,
	VALENTINA_MEMORIES_PRODUCTION_SIGN_URL,
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT,
	buildValentinaMemoriesObjectKey,
	getValentinaMemoriesMimePolicy,
	getValentinaMemoriesPresignExpiresAt,
	isAllowedValentinaMemoriesOrigin,
	isWithinValentinaMemoriesUploadWindow,
} from '@/data/valentina-memories-upload.contract';

function zoneParts(iso: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: VALENTINA_MEMORIES_EVENT_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(new Date(iso));

	return Object.fromEntries(
		parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
	);
}

describe('valentina memories upload contract', () => {
	it('locks the event identity, prefix, sign path, and public sign URL', () => {
		expect(VALENTINA_MEMORIES_EVENT_ID).toBe('valentina');
		expect(VALENTINA_MEMORIES_OBJECT_PREFIX).toBe('events/valentina/');
		expect(VALENTINA_MEMORIES_SIGN_PATH).toBe('/sign/valentina');
		expect(VALENTINA_MEMORIES_PRODUCTION_SIGN_URL).toBe(
			'https://memories.celebra-me.com/sign/valentina',
		);
		expect(VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME).toBe(
			'PUBLIC_VALENTINA_MEMORIES_SIGN_URL',
		);
		expect(VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN).toBe('https://www.celebra-me.com');
		expect(VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS).toBe(300);
		expect(VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS).toBe(30);
		expect(VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS).toBe(30 * 24 * 60 * 60);
	});

	it('caps images at 20 MB and videos at 80 MB', () => {
		expect(VALENTINA_MEMORIES_MAX_IMAGE_BYTES).toBe(20 * 1024 * 1024);
		expect(VALENTINA_MEMORIES_MAX_VIDEO_BYTES).toBe(80 * 1024 * 1024);
		expect(VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS).toBe(60);
		expect(getValentinaMemoriesMimePolicy('image/jpeg')?.maxBytes).toBe(
			VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
		);
		expect(getValentinaMemoriesMimePolicy('video/mp4')?.maxBytes).toBe(
			VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
		);
		expect(Object.keys(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES)).toEqual([
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/heic',
			'image/heif',
			'video/mp4',
			'video/quicktime',
		]);
	});

	it('maps MIME types to PII-free extensions', () => {
		expect(getValentinaMemoriesMimePolicy('IMAGE/JPEG')?.extension).toBe('jpg');
		expect(getValentinaMemoriesMimePolicy('video/quicktime')?.extension).toBe('mov');
		expect(getValentinaMemoriesMimePolicy('application/pdf')).toBeNull();
		expect(buildValentinaMemoriesObjectKey('11111111-1111-4111-8111-111111111111', 'jpg')).toBe(
			'events/valentina/11111111-1111-4111-8111-111111111111.jpg',
		);
	});

	it('authorizes only the production origin', () => {
		expect(isAllowedValentinaMemoriesOrigin('https://www.celebra-me.com')).toBe(true);
		expect(isAllowedValentinaMemoriesOrigin('https://celebra-me.com')).toBe(false);
		expect(isAllowedValentinaMemoriesOrigin('https://memories.celebra-me.com')).toBe(false);
		expect(isAllowedValentinaMemoriesOrigin(null)).toBe(false);
	});

	it('opens two calendar days before the event and closes five days after', () => {
		expect(zoneParts(VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT)).toMatchObject({
			year: '2026',
			month: '08',
			day: '27',
			hour: '00',
			minute: '00',
		});
		expect(zoneParts(VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT)).toMatchObject({
			year: '2026',
			month: '09',
			day: '04',
			hour: '00',
			minute: '00',
		});
		expect(isWithinValentinaMemoriesUploadWindow(new Date('2026-08-27T06:00:00.000Z'))).toBe(
			true,
		);
		expect(isWithinValentinaMemoriesUploadWindow(new Date('2026-08-27T05:59:59.999Z'))).toBe(
			false,
		);
		expect(isWithinValentinaMemoriesUploadWindow(new Date('2026-09-04T06:00:00.000Z'))).toBe(
			false,
		);
	});

	it('bounds presign expiration to five minutes', () => {
		const now = new Date('2026-08-29T21:45:00.000Z');
		expect(getValentinaMemoriesPresignExpiresAt(now).toISOString()).toBe(
			'2026-08-29T21:50:00.000Z',
		);
	});
});
