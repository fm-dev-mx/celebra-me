import { createHash } from 'node:crypto';
import { getSecretFromEnvOrFiles, PROD_SECRET_FILES } from './db-target-config.ts';
import {
	listR2Objects,
	r2Failure,
	r2ObjectUrl,
	r2SignedFetch,
	type Fetch,
	type OffsiteObject,
	type R2Location,
} from './offsite-backup.ts';

/**
 * Nightly incremental copy of Production media originals into a separate R2 backup bucket.
 * Only originals are copied: width variants (`.w<width>.webp`), social cards (`.og.jpg`) and
 * memories thumbnails are regenerated from them. Keys that already exist in the backup are skipped,
 * uploads never overwrite (`If-None-Match: *`), and this module never deletes objects. The backup
 * bucket owns retention: Bucket Lock per prefix, plus a lifecycle rule on `memories/` so a photo a
 * guest deletes leaves the backup about a month later.
 */

export interface MediaCopySource {
	/** Production bucket read with the read-only source token. */
	bucket: string;
	/** Prefix of the copy inside the backup bucket. */
	targetPrefix: string;
	/** Source key prefixes that hold originals. */
	sourcePrefixes: readonly string[];
	isOriginal: (key: string) => boolean;
}

export const MEDIA_COPY_SOURCES: readonly MediaCopySource[] = [
	{
		bucket: 'celebra-me-invitation-media',
		targetPrefix: 'invitation-media/',
		sourcePrefixes: ['invitations/', 'shared/'],
		isOriginal: (key) => !/\.w\d+\.webp$/u.test(key) && !key.endsWith('.og.jpg'),
	},
	{
		bucket: 'celebra-memories',
		targetPrefix: 'memories/',
		sourcePrefixes: ['events/'],
		isOriginal: (key) => !key.includes('/thumbs/'),
	},
];

export const MEDIA_COPY_ENV = {
	accountId: 'PROD_MEDIA_COPY_R2_ACCOUNT_ID',
	bucket: 'PROD_MEDIA_COPY_R2_BUCKET',
	sourceAccessKeyId: 'PROD_MEDIA_COPY_SOURCE_ACCESS_KEY_ID',
	sourceSecretAccessKey: 'PROD_MEDIA_COPY_SOURCE_SECRET_ACCESS_KEY',
	targetAccessKeyId: 'PROD_MEDIA_COPY_TARGET_ACCESS_KEY_ID',
	targetSecretAccessKey: 'PROD_MEDIA_COPY_TARGET_SECRET_ACCESS_KEY',
} as const;

export interface MediaCopyConfig {
	accountId: string;
	bucket: string;
	sourceAccessKeyId: string;
	sourceSecretAccessKey: string;
	targetAccessKeyId: string;
	targetSecretAccessKey: string;
}

/**
 * Reads the media copy settings from the shell or `.env.production.local`.
 * Returns null when none is set (feature not configured yet); a partial set fails closed.
 */
export function readMediaCopyConfig(
	read: (name: string) => string = (name) => getSecretFromEnvOrFiles(name, PROD_SECRET_FILES),
): MediaCopyConfig | null {
	const values = Object.fromEntries(
		Object.entries(MEDIA_COPY_ENV).map(([field, name]) => [field, read(name).trim()]),
	) as unknown as MediaCopyConfig;
	const missing = Object.entries(MEDIA_COPY_ENV)
		.filter(([field]) => !values[field as keyof MediaCopyConfig])
		.map(([, name]) => name);
	if (missing.length === Object.keys(MEDIA_COPY_ENV).length) return null;
	if (missing.length > 0) {
		throw new Error(`Media copy is partially configured. Missing: ${missing.join(', ')}.`);
	}
	if (!/^[0-9a-f]{32}$/.test(values.accountId)) {
		throw new Error(
			`${MEDIA_COPY_ENV.accountId} must be the 32-character Cloudflare account id.`,
		);
	}
	if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(values.bucket)) {
		throw new Error(`${MEDIA_COPY_ENV.bucket} is not a valid R2 bucket name.`);
	}
	if (MEDIA_COPY_SOURCES.some((source) => source.bucket === values.bucket)) {
		throw new Error(
			`${MEDIA_COPY_ENV.bucket} must be the backup bucket, not a Production bucket.`,
		);
	}
	if (values.sourceAccessKeyId === values.targetAccessKeyId) {
		throw new Error('The source (read-only) and backup (write) tokens must be different.');
	}
	return values;
}

export function sourceLocation(config: MediaCopyConfig, bucket: string): R2Location {
	return {
		accountId: config.accountId,
		bucket,
		accessKeyId: config.sourceAccessKeyId,
		secretAccessKey: config.sourceSecretAccessKey,
	};
}

export function targetLocation(config: MediaCopyConfig): R2Location {
	return {
		accountId: config.accountId,
		bucket: config.bucket,
		accessKeyId: config.targetAccessKeyId,
		secretAccessKey: config.targetSecretAccessKey,
	};
}

export interface MediaCopyItem {
	sourceBucket: string;
	sourceKey: string;
	targetKey: string;
	bytes: number;
}

export interface MediaCopyPlan {
	copy: MediaCopyItem[];
	alreadyPresent: number;
	/** Backup keys whose stored size differs from the source; never overwritten. */
	conflicts: MediaCopyItem[];
}

/** Compares source originals with the backup listing; pure so it is testable without R2. */
export function planMediaCopy(
	source: MediaCopySource,
	sourceObjects: readonly OffsiteObject[],
	targetObjects: readonly OffsiteObject[],
): MediaCopyPlan {
	const stored = new Map(targetObjects.map((object) => [object.key, object.bytes]));
	const plan: MediaCopyPlan = { copy: [], alreadyPresent: 0, conflicts: [] };
	for (const object of sourceObjects) {
		if (!source.sourcePrefixes.some((prefix) => object.key.startsWith(prefix))) continue;
		if (!source.isOriginal(object.key)) continue;
		const item = {
			sourceBucket: source.bucket,
			sourceKey: object.key,
			targetKey: `${source.targetPrefix}${object.key}`,
			bytes: object.bytes,
		};
		const storedBytes = stored.get(item.targetKey);
		if (storedBytes === undefined) plan.copy.push(item);
		else if (storedBytes === object.bytes) plan.alreadyPresent += 1;
		else plan.conflicts.push(item);
	}
	return plan;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/** Downloads one object; the body is buffered (originals are at most 80 MB). */
export async function downloadR2Object(
	location: R2Location,
	key: string,
	fetchImpl: Fetch = fetch,
): Promise<{
	body: Uint8Array;
	contentType: string;
	cacheControl: string | null;
	recordedSha256: string | null;
}> {
	const response = await r2SignedFetch(
		location,
		r2ObjectUrl(location, key),
		{ method: 'GET' },
		fetchImpl,
	);
	if (!response.ok) throw await r2Failure(`download of ${key}`, response);
	return {
		body: new Uint8Array(await response.arrayBuffer()),
		contentType: response.headers.get('content-type') || 'application/octet-stream',
		cacheControl: response.headers.get('cache-control'),
		recordedSha256: response.headers.get('x-amz-meta-sha256'),
	};
}

function isNotFound(error: unknown): boolean {
	return error instanceof Error && /HTTP 404/.test(error.message);
}

/** The sha256 a content-addressed invitation key carries (`<...>-<sha256>.<ext>`), if any. */
function keyDigest(key: string): string | undefined {
	return /-([a-f0-9]{64})\.[a-z0-9]+$/u.exec(key)?.[1];
}

/**
 * Copies one original into the backup bucket without overwriting, then checks the stored size.
 * Returns null when the source was deleted after it was listed (a guest removed a photo).
 */
export async function copyMediaObject(
	config: MediaCopyConfig,
	item: MediaCopyItem,
	fetchImpl: Fetch = fetch,
): Promise<number | null> {
	let source: Awaited<ReturnType<typeof downloadR2Object>>;
	try {
		source = await downloadR2Object(
			sourceLocation(config, item.sourceBucket),
			item.sourceKey,
			fetchImpl,
		);
	} catch (error: unknown) {
		if (isNotFound(error)) return null;
		throw error;
	}
	const { body, contentType, cacheControl } = source;
	const digest = sha256(body);
	const expected = keyDigest(item.sourceKey);
	if (expected && expected !== digest) {
		throw new Error(
			`Source ${item.sourceBucket}/${item.sourceKey} does not match its key digest.`,
		);
	}
	const target = targetLocation(config);
	const url = r2ObjectUrl(target, item.targetKey);
	const put = await r2SignedFetch(
		target,
		url,
		{
			method: 'PUT',
			body: new Uint8Array(body),
			headers: {
				'content-type': contentType,
				// Kept so a restore can put the object back exactly as Production served it.
				...(cacheControl ? { 'cache-control': cacheControl } : {}),
				'if-none-match': '*',
				'x-amz-content-sha256': digest,
				'x-amz-meta-sha256': digest,
			},
		},
		fetchImpl,
	);
	if (!put.ok) throw await r2Failure(`upload of ${item.targetKey}`, put);
	const head = await r2SignedFetch(target, url, { method: 'HEAD' }, fetchImpl);
	if (!head.ok) throw await r2Failure(`upload check of ${item.targetKey}`, head);
	const stored = Number(head.headers.get('content-length'));
	if (stored !== body.byteLength) {
		throw new Error(
			`R2 upload check failed for ${item.targetKey}: stored ${stored} bytes, sent ${body.byteLength}.`,
		);
	}
	return body.byteLength;
}

export interface MediaCopyResult {
	copied: number;
	bytes: number;
	alreadyPresent: number;
	/** Listed originals deleted from the source before they could be copied. */
	vanished: number;
	bySource: Record<string, { copied: number; alreadyPresent: number }>;
}

/**
 * Lists every source and copies the missing originals. One failing object does not stop the rest;
 * the run fails at the end on any copy failure or size conflict. `dryRun` only lists and plans.
 */
export async function runMediaCopy(
	config: MediaCopyConfig,
	options: {
		dryRun?: boolean;
		fetchImpl?: Fetch;
		log?: (line: string) => void;
	} = {},
): Promise<MediaCopyResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const log = options.log ?? (() => {});
	const result: MediaCopyResult = {
		copied: 0,
		bytes: 0,
		alreadyPresent: 0,
		vanished: 0,
		bySource: {},
	};
	const conflicts: MediaCopyItem[] = [];
	const failures: string[] = [];
	for (const source of MEDIA_COPY_SOURCES) {
		const location = sourceLocation(config, source.bucket);
		const sourceObjects = (
			await Promise.all(
				source.sourcePrefixes.map((prefix) => listR2Objects(location, prefix, fetchImpl)),
			)
		).flat();
		const targetObjects = await listR2Objects(
			targetLocation(config),
			source.targetPrefix,
			fetchImpl,
		);
		const plan = planMediaCopy(source, sourceObjects, targetObjects);
		conflicts.push(...plan.conflicts);
		const counts = { copied: 0, alreadyPresent: plan.alreadyPresent };
		if (options.dryRun) {
			for (const item of plan.copy) {
				log(`would copy ${item.sourceBucket}/${item.sourceKey} (${item.bytes} bytes)`);
			}
			counts.copied = plan.copy.length;
		} else {
			for (const item of plan.copy) {
				try {
					const bytes = await copyMediaObject(config, item, fetchImpl);
					if (bytes === null) {
						result.vanished += 1;
						continue;
					}
					result.bytes += bytes;
					counts.copied += 1;
				} catch (error: unknown) {
					failures.push(error instanceof Error ? error.message : String(error));
				}
			}
		}
		log(
			`${source.bucket}: ${counts.copied} ${options.dryRun ? 'to copy' : 'copied'}, ${counts.alreadyPresent} already in the backup`,
		);
		result.bySource[source.bucket] = counts;
		result.copied += counts.copied;
		result.alreadyPresent += counts.alreadyPresent;
	}
	if (conflicts.length > 0) {
		failures.push(
			`Backup objects differ in size from their source and were not overwritten: ${conflicts
				.map((item) => item.targetKey)
				.join(', ')}`,
		);
	}
	if (failures.length > 0) {
		throw new Error(
			`Media copy finished with ${failures.length} failure(s) after copying ${result.copied}:\n${failures.join('\n')}`,
		);
	}
	return result;
}

/** Maps a backup key back to its Production bucket and key. */
export function resolveBackupKey(targetKey: string): { bucket: string; key: string } {
	const source = MEDIA_COPY_SOURCES.find((candidate) =>
		targetKey.startsWith(candidate.targetPrefix),
	);
	if (!source) throw new Error(`Not a media backup key: ${targetKey}`);
	return { bucket: source.bucket, key: targetKey.slice(source.targetPrefix.length) };
}

export interface MediaRestoreDrill {
	targetKey: string;
	bytes: number;
	sha256: string;
	/** Against the sha256 in an invitation key, else the one recorded when the copy was made. */
	digestMatches: boolean | null;
	matchesSource: boolean | null;
	body: Uint8Array;
}

/**
 * Restore drill for one object: downloads it from the backup bucket and verifies it against its
 * expected digest and, while the original still exists, against the Production object (read-only).
 * Writes nothing to R2.
 */
export async function drillMediaRestore(
	config: MediaCopyConfig,
	targetKey: string,
	fetchImpl: Fetch = fetch,
): Promise<MediaRestoreDrill> {
	const { bucket, key } = resolveBackupKey(targetKey);
	const { body, recordedSha256 } = await downloadR2Object(
		targetLocation(config),
		targetKey,
		fetchImpl,
	);
	const digest = sha256(body);
	const expectedDigest = keyDigest(key) ?? recordedSha256;
	let matchesSource: boolean | null = null;
	try {
		const original = await downloadR2Object(sourceLocation(config, bucket), key, fetchImpl);
		matchesSource = sha256(original.body) === digest;
	} catch (error: unknown) {
		// A memories original deleted by its guest legitimately exists only in the backup.
		if (!isNotFound(error)) throw error;
	}
	const drill: MediaRestoreDrill = {
		targetKey,
		bytes: body.byteLength,
		sha256: digest,
		digestMatches: expectedDigest ? expectedDigest === digest : null,
		matchesSource,
		body,
	};
	if (drill.digestMatches === false || drill.matchesSource === false) {
		throw new Error(`Restored copy of ${targetKey} does not match its original.`);
	}
	if (drill.digestMatches === null && drill.matchesSource === null) {
		throw new Error(
			`Nothing to verify ${targetKey} against: no recorded digest and no source.`,
		);
	}
	return drill;
}
