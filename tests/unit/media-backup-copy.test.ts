/**
 * @jest-environment node
 */
import { createHash } from 'node:crypto';
import {
	drillMediaRestore,
	MEDIA_COPY_ENV,
	MEDIA_COPY_SOURCES,
	planMediaCopy,
	readMediaCopyConfig,
	resolveBackupKey,
	runMediaCopy,
	type MediaCopyConfig,
} from '../../scripts/db/media-backup-copy';

const config: MediaCopyConfig = {
	accountId: '05cb212a366549f0f93e7101c4ca3692',
	bucket: 'celebra-me-media-backup',
	sourceAccessKeyId: 'test-source-key',
	sourceSecretAccessKey: 'test-source-secret',
	targetAccessKeyId: 'test-target-key',
	targetSecretAccessKey: 'test-target-secret',
};

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const photoDigest = sha('photo bytes');
const photoKey = `invitations/xv/andrea/hero-${photoDigest}.webp`;
const eventId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const memoryKey = `events/${eventId}/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg`;

interface StoredObject {
	body: Buffer;
	contentType: string;
	cacheControl?: string;
	sha256?: string;
}

/** In-memory R2 behind the S3 API: list-type=2, GET, HEAD and conditional PUT. */
function fakeR2(buckets: Record<string, Record<string, StoredObject>>) {
	const requests: Array<{ method: string; bucket: string; key: string; auth: string }> = [];
	const fetchImpl = (async (input: Request) => {
		const url = new URL(input.url);
		const [, bucket, ...rest] = url.pathname.split('/');
		const key = rest.map((segment) => decodeURIComponent(segment)).join('/');
		requests.push({
			method: input.method,
			bucket,
			key,
			auth: input.headers.get('authorization') ?? '',
		});
		const store = buckets[bucket];
		if (!store)
			return new Response('<Error><Code>NoSuchBucket</Code></Error>', { status: 404 });
		if (input.method === 'GET' && url.searchParams.get('list-type') === '2') {
			const prefix = url.searchParams.get('prefix') ?? '';
			const contents = Object.entries(store)
				.filter(([name]) => name.startsWith(prefix))
				.map(
					([name, object]) =>
						`<Contents><Key>${name}</Key><Size>${object.body.byteLength}</Size><LastModified>2026-10-25T10:00:00.000Z</LastModified></Contents>`,
				)
				.join('');
			return new Response(
				`<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`,
			);
		}
		const object = store[key];
		if (input.method === 'PUT') {
			if (object && input.headers.get('if-none-match') === '*') {
				return new Response('<Error><Code>PreconditionFailed</Code></Error>', {
					status: 412,
				});
			}
			store[key] = {
				body: Buffer.from(await input.arrayBuffer()),
				contentType: input.headers.get('content-type') ?? '',
				cacheControl: input.headers.get('cache-control') ?? undefined,
				sha256: input.headers.get('x-amz-meta-sha256') ?? undefined,
			};
			return new Response(null, { status: 200 });
		}
		if (!object) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
		const headers = {
			'content-length': String(object.body.byteLength),
			'content-type': object.contentType,
			...(object.cacheControl ? { 'cache-control': object.cacheControl } : {}),
			...(object.sha256 ? { 'x-amz-meta-sha256': object.sha256 } : {}),
		};
		if (input.method === 'HEAD') return new Response(null, { headers });
		return new Response(new Uint8Array(object.body), { headers });
	}) as unknown as typeof fetch;
	return { fetchImpl, requests };
}

function productionBuckets(): Record<string, Record<string, StoredObject>> {
	const image = (text: string): StoredObject => ({
		body: Buffer.from(text),
		contentType: 'image/webp',
		cacheControl: 'public, max-age=31536000, immutable',
	});
	return {
		'celebra-me-invitation-media': {
			[photoKey]: image('photo bytes'),
			[photoKey.replace('.webp', '.w800.webp')]: image('variant'),
			[photoKey.replace('.webp', '.og.jpg')]: image('social card'),
			'shared/music/song.mp3': { body: Buffer.from('mp3'), contentType: 'audio/mpeg' },
		},
		'celebra-memories': {
			[memoryKey]: { body: Buffer.from('guest photo'), contentType: 'image/jpeg' },
			[`events/${eventId}/thumbs/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp`]: image('thumb'),
		},
		'celebra-me-media-backup': {},
	};
}

describe('media copy configuration', () => {
	it('treats a fully empty configuration as not configured', () => {
		expect(readMediaCopyConfig(() => '')).toBeNull();
	});

	it('fails closed on a partial configuration', () => {
		expect(() =>
			readMediaCopyConfig((name) => (name === MEDIA_COPY_ENV.bucket ? config.bucket : '')),
		).toThrow(/partially configured/);
	});

	it('refuses a Production bucket as the backup target and a shared token', () => {
		const env = (overrides: Partial<MediaCopyConfig>) => {
			const values = { ...config, ...overrides };
			const byName = Object.fromEntries(
				Object.entries(MEDIA_COPY_ENV).map(([field, name]) => [
					name,
					values[field as keyof MediaCopyConfig],
				]),
			);
			return (name: string) => byName[name] ?? '';
		};
		expect(readMediaCopyConfig(env({}))).toEqual(config);
		expect(() => readMediaCopyConfig(env({ bucket: 'celebra-memories' }))).toThrow(
			/backup bucket/,
		);
		expect(() =>
			readMediaCopyConfig(env({ targetAccessKeyId: config.sourceAccessKeyId })),
		).toThrow(/must be different/);
	});
});

describe('media copy plan', () => {
	const [media, memories] = MEDIA_COPY_SOURCES;
	const listed = (keys: string[], bytes = 10) =>
		keys.map((key) => ({ key, bytes, lastModified: '' }));

	it('keeps originals and skips variants, social cards and thumbnails', () => {
		const plan = planMediaCopy(
			media,
			listed([
				photoKey,
				photoKey.replace('.webp', '.w1600.webp'),
				photoKey.replace('.webp', '.og.jpg'),
			]),
			[],
		);
		expect(plan.copy.map((item) => item.targetKey)).toEqual([`invitation-media/${photoKey}`]);
		const memoryPlan = planMediaCopy(
			memories,
			listed([memoryKey, `events/${eventId}/thumbs/x.webp`]),
			[],
		);
		expect(memoryPlan.copy.map((item) => item.targetKey)).toEqual([`memories/${memoryKey}`]);
	});

	it('skips keys already in the backup and reports a size conflict instead of overwriting', () => {
		const plan = planMediaCopy(media, listed([photoKey, 'shared/a.mp3']), [
			{ key: `invitation-media/${photoKey}`, bytes: 10, lastModified: '' },
			{ key: 'invitation-media/shared/a.mp3', bytes: 99, lastModified: '' },
		]);
		expect(plan.copy).toEqual([]);
		expect(plan.alreadyPresent).toBe(1);
		expect(plan.conflicts.map((item) => item.sourceKey)).toEqual(['shared/a.mp3']);
	});

	it('maps a backup key back to its Production bucket', () => {
		expect(resolveBackupKey(`memories/${memoryKey}`)).toEqual({
			bucket: 'celebra-memories',
			key: memoryKey,
		});
		expect(() => resolveBackupKey('daily/x.bundle.age')).toThrow(/Not a media backup key/);
	});
});

describe('media copy run', () => {
	it('copies only new originals, with the read token on sources and the write token on the backup', async () => {
		const buckets = productionBuckets();
		const { fetchImpl, requests } = fakeR2(buckets);

		const first = await runMediaCopy(config, { fetchImpl });
		expect(first.copied).toBe(3);
		expect(Object.keys(buckets['celebra-me-media-backup']).sort()).toEqual([
			`invitation-media/${photoKey}`,
			'invitation-media/shared/music/song.mp3',
			`memories/${memoryKey}`,
		]);
		const copy = buckets['celebra-me-media-backup'][`invitation-media/${photoKey}`];
		expect(copy.body.toString()).toBe('photo bytes');
		expect(copy.contentType).toBe('image/webp');
		expect(copy.cacheControl).toBe('public, max-age=31536000, immutable');

		for (const request of requests) {
			const token =
				request.bucket === config.bucket
					? config.targetAccessKeyId
					: config.sourceAccessKeyId;
			expect(request.auth).toContain(`Credential=${token}/`);
		}
		expect(
			requests.filter(
				(request) => request.bucket !== config.bucket && request.method !== 'GET',
			),
		).toEqual([]);

		requests.length = 0;
		const second = await runMediaCopy(config, { fetchImpl });
		expect(second).toMatchObject({ copied: 0, alreadyPresent: 3 });
		expect(requests.some((request) => request.method === 'PUT')).toBe(false);
	});

	it('plans without writing on a dry run', async () => {
		const buckets = productionBuckets();
		const { fetchImpl } = fakeR2(buckets);
		const lines: string[] = [];
		const result = await runMediaCopy(config, {
			dryRun: true,
			fetchImpl,
			log: (line) => lines.push(line),
		});
		expect(result.copied).toBe(3);
		expect(buckets['celebra-me-media-backup']).toEqual({});
		expect(lines.some((line) => line.startsWith('would copy celebra-memories/'))).toBe(true);
	});

	it('skips an original deleted after listing and keeps copying after one failure', async () => {
		const buckets = productionBuckets();
		const { fetchImpl: base } = fakeR2(buckets);
		const corrupt = `invitations/xv/andrea/gallery-${sha('expected')}.webp`;
		buckets['celebra-me-invitation-media'][corrupt] = {
			body: Buffer.from('not the expected bytes'),
			contentType: 'image/webp',
		};
		const fetchImpl = (async (input: Request) => {
			// The guest deletes the photo between the listing and the download.
			if (input.method === 'GET' && input.url.includes('celebra-memories/events/')) {
				delete buckets['celebra-memories'][memoryKey];
			}
			return base(input);
		}) as unknown as typeof fetch;

		await expect(runMediaCopy(config, { fetchImpl })).rejects.toThrow(
			/1 failure\(s\) after copying 2:\n.*gallery-.*does not match its key digest/,
		);
		expect(Object.keys(buckets['celebra-me-media-backup']).sort()).toEqual([
			`invitation-media/${photoKey}`,
			'invitation-media/shared/music/song.mp3',
		]);
	});

	it('fails on a size conflict without touching the existing backup copy', async () => {
		const buckets = productionBuckets();
		buckets['celebra-me-media-backup'][`invitation-media/${photoKey}`] = {
			body: Buffer.from('other'),
			contentType: 'image/webp',
		};
		const { fetchImpl } = fakeR2(buckets);
		await expect(runMediaCopy(config, { fetchImpl })).rejects.toThrow(/not overwritten/);
		expect(
			buckets['celebra-me-media-backup'][`invitation-media/${photoKey}`].body.toString(),
		).toBe('other');
	});
});

describe('media restore drill', () => {
	it('restores one invitation original and verifies its key digest and Production copy', async () => {
		const buckets = productionBuckets();
		const { fetchImpl, requests } = fakeR2(buckets);
		await runMediaCopy(config, { fetchImpl });
		requests.length = 0;

		const drill = await drillMediaRestore(config, `invitation-media/${photoKey}`, fetchImpl);
		expect(drill).toMatchObject({
			sha256: photoDigest,
			digestMatches: true,
			matchesSource: true,
		});
		expect(Buffer.from(drill.body).toString()).toBe('photo bytes');
		expect(requests.every((request) => request.method === 'GET')).toBe(true);
	});

	it('verifies a guest photo by its recorded digest after the original was deleted', async () => {
		const buckets = productionBuckets();
		const { fetchImpl } = fakeR2(buckets);
		await runMediaCopy(config, { fetchImpl });
		delete buckets['celebra-memories'][memoryKey];

		await expect(
			drillMediaRestore(config, `memories/${memoryKey}`, fetchImpl),
		).resolves.toMatchObject({
			sha256: sha('guest photo'),
			digestMatches: true,
			matchesSource: null,
		});

		delete buckets['celebra-me-media-backup'][`memories/${memoryKey}`].sha256;
		await expect(drillMediaRestore(config, `memories/${memoryKey}`, fetchImpl)).rejects.toThrow(
			/Nothing to verify/,
		);
	});

	it('fails when the backup copy no longer matches its key digest', async () => {
		const buckets = productionBuckets();
		buckets['celebra-me-media-backup'][`invitation-media/${photoKey}`] = {
			body: Buffer.from('tampered'),
			contentType: 'image/webp',
		};
		const { fetchImpl } = fakeR2(buckets);
		await expect(
			drillMediaRestore(config, `invitation-media/${photoKey}`, fetchImpl),
		).rejects.toThrow(/does not match/);
	});
});
