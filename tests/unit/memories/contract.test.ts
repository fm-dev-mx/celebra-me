import {
	MEMORIES_RECOVERY_CODE_PATTERN,
	calculateMemoriesGuestQuota,
	canTransitionMemoriesMedia,
	formatMemoriesCodeGroups,
	resolveMemoriesWindowState,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';
import {
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
	getMemoriesMimePolicy,
	isMemoriesVideoMime,
	resolveMemoriesFileMimeType,
} from '@/lib/memories/contract/media-policy';
import {
	buildMemoriesObjectKey,
	isMemoriesObjectKeyForMime,
	parseMemoriesObjectKey,
} from '@/lib/memories/contract/object-key';
import {
	buildMemoriesPublicUrl,
	buildMemoriesSessionCookieName,
	isMemoriesPublicSlug,
} from '@/lib/memories/contract/private-request';
import { EVENT_ID, OBJECT_ID, PUBLIC_SLUG, buildSpace } from './fixtures';

describe('memories media policy', () => {
	it('prefers the declared MIME type when it is allowed', () => {
		expect(resolveMemoriesFileMimeType({ type: 'image/png', name: 'photo.jpg' })).toBe(
			'image/png',
		);
		expect(resolveMemoriesFileMimeType({ type: ' VIDEO/MP4 ', name: 'clip.bin' })).toBe(
			'video/mp4',
		);
	});

	it('falls back to the file extension when the browser declares nothing useful', () => {
		expect(resolveMemoriesFileMimeType({ type: '', name: 'IMG_0001.HEIC' })).toBe('image/heic');
		expect(
			resolveMemoriesFileMimeType({ type: 'application/octet-stream', name: 'clip.mov' }),
		).toBe('video/quicktime');
	});

	it('maps the jpeg extension alias to image/jpeg', () => {
		expect(resolveMemoriesFileMimeType({ type: '', name: 'photo.jpeg' })).toBe('image/jpeg');
	});

	it('returns null for unsupported files', () => {
		expect(resolveMemoriesFileMimeType({ type: 'text/plain', name: 'notes.txt' })).toBeNull();
		expect(resolveMemoriesFileMimeType({ type: '', name: 'archive' })).toBeNull();
	});

	it('exposes per-category limits through the MIME policy', () => {
		expect(getMemoriesMimePolicy('image/jpeg')).toEqual({
			category: 'image',
			extension: 'jpg',
			maxBytes: MEMORIES_MAX_IMAGE_BYTES,
		});
		expect(getMemoriesMimePolicy('video/quicktime')).toEqual({
			category: 'video',
			extension: 'mov',
			maxBytes: MEMORIES_MAX_VIDEO_BYTES,
		});
		expect(MEMORIES_MAX_IMAGE_BYTES).toBe(20 * 1024 * 1024);
		expect(MEMORIES_MAX_VIDEO_BYTES).toBe(80 * 1024 * 1024);
		expect(getMemoriesMimePolicy(' Image/PNG ')).not.toBeNull();
		expect(getMemoriesMimePolicy('image/gif')).toBeNull();
	});

	it('detects video MIME types case-insensitively', () => {
		expect(isMemoriesVideoMime('video/mp4')).toBe(true);
		expect(isMemoriesVideoMime('VIDEO/QUICKTIME')).toBe(true);
		expect(isMemoriesVideoMime('image/jpeg')).toBe(false);
	});
});

describe('memories object keys', () => {
	const key = buildMemoriesObjectKey(EVENT_ID, OBJECT_ID, 'jpg');

	it('builds and parses the events/<event>/<object>.<ext> layout', () => {
		expect(key).toBe(`events/${EVENT_ID}/${OBJECT_ID}.jpg`);
		expect(parseMemoriesObjectKey(key)).toEqual({
			eventId: EVENT_ID,
			objectId: OBJECT_ID,
			extension: 'jpg',
		});
	});

	it('matches a key against the extension of its MIME policy', () => {
		expect(isMemoriesObjectKeyForMime(key, 'image/jpeg')).toBe(true);
		expect(isMemoriesObjectKeyForMime(key, 'image/png')).toBe(false);
		expect(isMemoriesObjectKeyForMime(key, 'application/pdf')).toBe(false);
		expect(isMemoriesObjectKeyForMime(key, undefined)).toBe(false);
	});

	it('rejects keys without the events prefix', () => {
		expect(parseMemoriesObjectKey(`photos/${EVENT_ID}/${OBJECT_ID}.jpg`)).toBeNull();
		expect(parseMemoriesObjectKey(`/events/${EVENT_ID}/${OBJECT_ID}.jpg`)).toBeNull();
	});

	it('rejects non-uuid segments and non-string input', () => {
		expect(parseMemoriesObjectKey(`events/${PUBLIC_SLUG}/${OBJECT_ID}.jpg`)).toBeNull();
		expect(parseMemoriesObjectKey(`events/${EVENT_ID}/photo.jpg`)).toBeNull();
		expect(parseMemoriesObjectKey(`events/${EVENT_ID}/${OBJECT_ID}`)).toBeNull();
		expect(parseMemoriesObjectKey(42)).toBeNull();
		expect(parseMemoriesObjectKey(null)).toBeNull();
	});

	it('accepts uppercase uuids and lowercases them', () => {
		const upper = `events/${EVENT_ID.toUpperCase()}/${OBJECT_ID.toUpperCase()}.jpg`;
		expect(parseMemoriesObjectKey(upper)).toEqual({
			eventId: EVENT_ID,
			objectId: OBJECT_ID,
			extension: 'jpg',
		});
	});
});

describe('resolveMemoriesWindowState', () => {
	const space = buildSpace();

	it('follows the schedule for an enabled space', () => {
		expect(resolveMemoriesWindowState(space, new Date('2026-10-10T00:00:00.000Z'))).toBe(
			'before',
		);
		expect(resolveMemoriesWindowState(space, new Date('2026-10-16T07:00:00.000Z'))).toBe(
			'open',
		);
		expect(resolveMemoriesWindowState(space, new Date('2026-10-24T12:00:00.000Z'))).toBe(
			'open',
		);
		expect(resolveMemoriesWindowState(space, new Date('2026-10-31T07:00:00.000Z'))).toBe(
			'closed',
		);
		expect(resolveMemoriesWindowState(space, new Date('2026-12-01T00:00:00.000Z'))).toBe(
			'closed',
		);
		expect(resolveMemoriesWindowState(space, new Date('2026-12-30T07:00:00.000Z'))).toBe(
			'expired',
		);
	});

	it('lets disabled win over before, open and closed', () => {
		const disabled = buildSpace({ enabled: false });
		expect(resolveMemoriesWindowState(disabled, new Date('2026-10-10T00:00:00.000Z'))).toBe(
			'disabled',
		);
		expect(resolveMemoriesWindowState(disabled, new Date('2026-10-24T12:00:00.000Z'))).toBe(
			'disabled',
		);
		expect(resolveMemoriesWindowState(disabled, new Date('2026-12-01T00:00:00.000Z'))).toBe(
			'disabled',
		);
	});

	it('lets expired win over disabled', () => {
		const disabled = buildSpace({ enabled: false });
		expect(resolveMemoriesWindowState(disabled, new Date('2027-01-15T00:00:00.000Z'))).toBe(
			'expired',
		);
	});
});

describe('calculateMemoriesGuestQuota', () => {
	const limits = { maxSessionFiles: 3, maxSessionVideos: 1, maxSessionBytes: 5_000 };

	it('counts resident files, videos, bytes and in-flight uploads against the limits', () => {
		const quota = calculateMemoriesGuestQuota(
			[
				{
					mimeType: 'image/jpeg',
					sizeBytes: 1_000,
					status: 'accepted',
					objectDeleted: false,
				},
				{
					mimeType: 'video/mp4',
					sizeBytes: 2_500,
					status: 'uploading',
					objectDeleted: false,
				},
				{
					mimeType: 'image/png',
					sizeBytes: 500,
					status: 'validating',
					objectDeleted: false,
				},
				{ mimeType: 'video/mp4', sizeBytes: 9_000, status: 'deleted', objectDeleted: true },
			],
			limits,
			2,
		);
		expect(quota).toEqual({
			files: { used: 3, remaining: 0, limit: 3 },
			videos: { used: 1, remaining: 0, limit: 1 },
			bytes: { used: 4_000, remaining: 1_000, limit: 5_000 },
			inFlight: { used: 2, remaining: 0, limit: 2 },
		});
	});

	it('never reports negative remaining capacity', () => {
		const quota = calculateMemoriesGuestQuota(
			[
				{
					mimeType: 'video/mp4',
					sizeBytes: 4_000,
					status: 'accepted',
					objectDeleted: false,
				},
				{
					mimeType: 'video/mp4',
					sizeBytes: 4_000,
					status: 'accepted',
					objectDeleted: false,
				},
			],
			limits,
			2,
		);
		expect(quota.videos).toEqual({ used: 2, remaining: 0, limit: 1 });
		expect(quota.bytes).toEqual({ used: 8_000, remaining: 0, limit: 5_000 });
		expect(quota.inFlight).toEqual({ used: 0, remaining: 2, limit: 2 });
	});

	it('ignores rows whose object was already removed from storage', () => {
		const quota = calculateMemoriesGuestQuota(
			[{ mimeType: 'image/jpeg', sizeBytes: 4_000, status: 'accepted', objectDeleted: true }],
			limits,
			2,
		);
		expect(quota.files.used).toBe(0);
		expect(quota.bytes.used).toBe(0);
	});
});

describe('recovery code pattern', () => {
	it('accepts codes produced by formatMemoriesCodeGroups', () => {
		const code = formatMemoriesCodeGroups('ABCDEFGHJKLM', 3);
		expect(code).toBe('ABCD-EFGH-JKLM');
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test(code)).toBe(true);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('2345-6789-ZYXW')).toBe(true);
	});

	it('rejects ambiguous characters, wrong grouping and lowercase input', () => {
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCD-EFGH-JKL0')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCD-EFGH-JKL1')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCD-EFGH-JKLI')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCD-EFGH-JKLO')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('abcd-efgh-jklm')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCDEFGHJKLM')).toBe(false);
		expect(MEMORIES_RECOVERY_CODE_PATTERN.test('ABCD-EFGH')).toBe(false);
	});
});

describe('public slug and routing constants', () => {
	it('accepts lowercase kebab-case slugs up to 64 characters', () => {
		expect(isMemoriesPublicSlug(PUBLIC_SLUG)).toBe(true);
		expect(isMemoriesPublicSlug('xv-2026')).toBe(true);
		expect(isMemoriesPublicSlug('a'.repeat(64))).toBe(true);
	});

	it('rejects uppercase, edge hyphens, overlong values and non-strings', () => {
		expect(isMemoriesPublicSlug('Victoria-y-Roberto')).toBe(false);
		expect(isMemoriesPublicSlug('-victoria')).toBe(false);
		expect(isMemoriesPublicSlug('victoria-')).toBe(false);
		expect(isMemoriesPublicSlug('victoria--roberto')).toBe(false);
		expect(isMemoriesPublicSlug('a'.repeat(65))).toBe(false);
		expect(isMemoriesPublicSlug('')).toBe(false);
		expect(isMemoriesPublicSlug(undefined)).toBe(false);
		expect(isMemoriesPublicSlug(['victoria'])).toBe(false);
	});

	it('builds the printed QR URL from the fixed public origin', () => {
		expect(buildMemoriesPublicUrl(PUBLIC_SLUG)).toBe(
			'https://celebra-me.com/r/victoria-y-roberto',
		);
	});

	it('names the guest session cookie with the __Host- prefix per space', () => {
		const name = buildMemoriesSessionCookieName(PUBLIC_SLUG);
		expect(name.startsWith('__Host-')).toBe(true);
		expect(name).toBe('__Host-memories_victoria-y-roberto');
		expect(buildMemoriesSessionCookieName('otro-evento')).not.toBe(name);
	});
});

describe('media status transitions', () => {
	it('allows only the documented transitions', () => {
		expect(canTransitionMemoriesMedia('uploading', 'validating')).toBe(true);
		expect(canTransitionMemoriesMedia('uploading', 'deleted')).toBe(true);
		expect(canTransitionMemoriesMedia('validating', 'accepted')).toBe(true);
		expect(canTransitionMemoriesMedia('validating', 'duplicate')).toBe(true);
		expect(canTransitionMemoriesMedia('accepted', 'rejected')).toBe(true);
		expect(canTransitionMemoriesMedia('accepted', 'deleted')).toBe(true);
		expect(canTransitionMemoriesMedia('rejected', 'deleted')).toBe(true);
		expect(canTransitionMemoriesMedia('duplicate', 'deleted')).toBe(true);
	});

	it('forbids going backwards or leaving the deleted state', () => {
		expect(canTransitionMemoriesMedia('uploading', 'accepted')).toBe(false);
		expect(canTransitionMemoriesMedia('accepted', 'uploading')).toBe(false);
		expect(canTransitionMemoriesMedia('accepted', 'validating')).toBe(false);
		expect(canTransitionMemoriesMedia('rejected', 'accepted')).toBe(false);
		expect(canTransitionMemoriesMedia('deleted', 'accepted')).toBe(false);
		expect(canTransitionMemoriesMedia('deleted', 'deleted')).toBe(false);
	});
});

describe('limit profiles', () => {
	it('pins the standard profile', () => {
		expect(MEMORIES_LIMIT_PROFILES.standard).toEqual({
			maxEventObjects: 1500,
			maxEventBytes: 5000000000,
			maxSessionFiles: 15,
			maxSessionVideos: 3,
			maxSessionBytes: 314572800,
		});
	});

	it('pins the extended profile at twice the standard one', () => {
		expect(MEMORIES_LIMIT_PROFILES.extended).toEqual({
			maxEventObjects: 3000,
			maxEventBytes: 10000000000,
			maxSessionFiles: 30,
			maxSessionVideos: 6,
			maxSessionBytes: 629145600,
		});
	});
});
