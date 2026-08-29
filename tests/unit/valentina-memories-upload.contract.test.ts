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
	VALENTINA_MEMORIES_EVENT_MAX_BYTES,
	VALENTINA_MEMORIES_EVENT_MAX_OBJECTS,
	VALENTINA_MEMORIES_SESSION_MAX_BYTES,
	VALENTINA_MEMORIES_SESSION_MAX_FILES,
	VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT,
	VALENTINA_MEMORIES_RATE_LIMIT,
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT,
	buildValentinaMemoriesObjectKey,
	getValentinaMemoriesMimePolicy,
	getValentinaMemoriesPresignExpiresAt,
	isAllowedValentinaMemoriesOrigin,
	isWithinValentinaMemoriesUploadWindow,
	resolveValentinaMemoriesFileMimeType,
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
	it('locks the event identity, prefix, private sign target, and retention', () => {
		expect(VALENTINA_MEMORIES_EVENT_ID).toBe('valentina');
		expect(VALENTINA_MEMORIES_OBJECT_PREFIX).toBe('events/valentina/');
		expect(VALENTINA_MEMORIES_SIGN_PATH).toBe('/sign/valentina');
		expect(VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN).toBe('https://www.celebra-me.com');
		expect(VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS).toBe(300);
		expect(VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS).toBe(30);
		expect(VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS).toBe(30 * 24 * 60 * 60);
	});

	it('keeps session and event quotas in the canonical contract', () => {
		expect(VALENTINA_MEMORIES_SESSION_MAX_FILES).toBe(20);
		expect(VALENTINA_MEMORIES_SESSION_MAX_BYTES).toBe(512 * 1024 * 1024);
		expect(VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT).toBe(2);
		expect(VALENTINA_MEMORIES_RATE_LIMIT.limit).toBe(6);
		expect(VALENTINA_MEMORIES_EVENT_MAX_OBJECTS).toBe(2_000);
		expect(VALENTINA_MEMORIES_EVENT_MAX_BYTES).toBe(8_000_000_000);
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

	it('recovers known phone MIME types from file extensions when browsers omit them', () => {
		expect(resolveValentinaMemoriesFileMimeType({ name: 'IMG_0001.HEIC', type: '' })).toBe(
			'image/heic',
		);
		expect(resolveValentinaMemoriesFileMimeType({ name: 'clip.MOV', type: '' })).toBe(
			'video/quicktime',
		);
		expect(resolveValentinaMemoriesFileMimeType({ name: 'photo.jpeg', type: '' })).toBe(
			'image/jpeg',
		);
		expect(resolveValentinaMemoriesFileMimeType({ name: 'payload.pdf', type: '' })).toBeNull();
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
