/**
 * In-process memories stack for lifecycle tests: the real app services and the
 * real Worker handlers, joined by an in-memory R2 bucket and an in-memory
 * catalog that mirrors the reservation RPC. Not matched by `testMatch`.
 *
 * The SQL rules themselves are proven by `supabase/tests/event_memories_*.sql`;
 * this catalog only has to agree with them so the layers above can be exercised.
 */

import { createHash, generateKeyPairSync, randomUUID, webcrypto } from 'node:crypto';
import {
	ReadableStream as NodeReadableStream,
	TransformStream as NodeTransformStream,
} from 'node:stream/web';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import { MEMORIES_SIGN_RATE_LIMIT } from '@/lib/memories/contract/limits';
import { roundMemoriesVideoDurationSeconds } from '@/lib/memories/contract/media-policy';
import type {
	MediaRow,
	SessionRow,
	StaleMediaCursor,
} from '@/lib/memories/server/catalog.repository';
import { MEMORIES_ENV } from '@/lib/memories/server/config';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import retrieveWorker from '../../workers/celebra-memories-retrieve/src/index';
import type { MemoriesSignEnv } from '../../workers/celebra-memories-sign/src/env';
import signWorker from '../../workers/celebra-memories-sign/src/index';

type RetrieveEnv = Parameters<typeof retrieveWorker.fetch>[1];
type Bucket = MemoriesSignEnv['MEMORIES_BUCKET'];
type StoredObject = NonNullable<Awaited<ReturnType<RetrieveEnv['MEMORIES_BUCKET']['get']>>>;

const SIGN_WORKER_ORIGIN = 'https://memories-sign.example.invalid';
const RETRIEVE_WORKER_ORIGIN = 'https://memories-retrieve.example.invalid';
export const BROWSER_ORIGIN = 'https://www.celebra-me.com';

// Worker runtime globals the handlers expect -----------------------------------

export class TestFixedLengthStream {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;

	constructor(expectedLength: number) {
		let total = 0;
		const transform = new NodeTransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				total += chunk.byteLength;
				if (total > expectedLength) throw new Error('too many bytes');
				controller.enqueue(chunk);
			},
			flush() {
				if (total !== expectedLength) throw new Error('not enough bytes');
			},
		});
		this.readable = transform.readable as unknown as ReadableStream<Uint8Array>;
		this.writable = transform.writable as unknown as WritableStream<Uint8Array>;
	}
}

export function installWorkerRuntimeGlobals(): void {
	Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
	Object.defineProperty(globalThis, 'ReadableStream', {
		configurable: true,
		value: NodeReadableStream,
	});
	Object.defineProperty(globalThis, 'FixedLengthStream', {
		configurable: true,
		value: TestFixedLengthStream,
	});
}

export function streamOf(data: Uint8Array | string): ReadableStream<Uint8Array> {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	return new NodeReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	}) as unknown as ReadableStream<Uint8Array>;
}

export async function readStream(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
	if (!body) return new Uint8Array(0);
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		length += value.byteLength;
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export function sha256Hex(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

// R2 ---------------------------------------------------------------------------------

/** Stores real bytes and enforces what R2 enforces: checksum and `onlyIf`. */
export class InMemoryBucket {
	readonly objects = new Map<string, Uint8Array>();

	readonly binding: Bucket & RetrieveEnv['MEMORIES_BUCKET'] = {
		put: async (key, body, options) => {
			const bytes = await readStream(body as ReadableStream<Uint8Array>);
			if (options?.onlyIf && this.objects.has(key)) return null;
			if (options?.sha256) {
				const expected = Buffer.from(options.sha256 as ArrayBuffer).toString('hex');
				if (sha256Hex(bytes) !== expected) throw new Error('checksum mismatch');
			}
			this.objects.set(key, bytes);
			return { key };
		},
		get: async (key, options) => {
			const bytes = this.objects.get(key);
			if (!bytes) return null;
			const offset = options?.range?.offset ?? 0;
			const length = options?.range?.length ?? bytes.byteLength - offset;
			return {
				body: streamOf(bytes.subarray(offset, offset + length)),
				size: bytes.byteLength,
				checksums: {
					sha256: Uint8Array.from(Buffer.from(sha256Hex(bytes), 'hex')).buffer,
					toJSON: () => ({}),
				},
			} as StoredObject;
		},
		delete: async (key) => {
			this.objects.delete(key as string);
		},
	};
}

// Catalog ----------------------------------------------------------------------------

function refuse(token: string): never {
	throw new SupabaseHttpError(400, `{"code":"P0001","message":"${token}"}`, 'P0001');
}

function nowIso(): string {
	return new Date().toISOString();
}

type AuditRow = { eventId: string; mediaItemId: string | null; action: string; expiresAt: string };

/** Mirrors `reserve_event_memory_item` and its sibling RPCs for a single space. */
class InMemoryCatalog {
	space: MemoriesSpaceRecord | null = null;
	sessions: SessionRow[] = [];
	items: MediaRow[] = [];
	audit: AuditRow[] = [];

	reset(space: MemoriesSpaceRecord): void {
		this.space = space;
		this.sessions = [];
		this.items = [];
		this.audit = [];
	}

	addSession(displayName: string): SessionRow {
		if (!this.space) throw new Error('No space.');
		const session: SessionRow = {
			id: randomUUID(),
			event_id: this.space.eventId,
			created_at: nowIso(),
			last_seen_at: nowIso(),
			expires_at: this.space.retentionEndsAt,
			revoked_at: null,
			anonymized_at: null,
			display_name: displayName,
			guest_alias: `invitado-${randomUUID().slice(0, 8)}`,
		};
		this.sessions.push(session);
		return { ...session };
	}

	private row(itemId: string): MediaRow | undefined {
		return this.items.find((item) => item.id === itemId);
	}

	readonly module = {
		reserveMedia: async (input: {
			eventId: string;
			sessionId: string;
			objectKey: string;
			mimeType: string;
			sizeBytes: number;
			checksumSha256: string;
			durationSeconds: number | null;
			idempotencyKey: string;
			maxSessionInFlight: number;
		}): Promise<MediaRow | null> => {
			const now = Date.now();
			const space = this.space;
			if (!space || !space.enabled || Date.parse(space.retentionEndsAt) <= now)
				refuse('memories_space_unavailable');
			if (now < Date.parse(space.uploadStartsAt) || now >= Date.parse(space.uploadEndsAt))
				refuse('memories_upload_window_closed');
			const session = this.sessions.find(
				(candidate) =>
					candidate.id === input.sessionId &&
					candidate.revoked_at === null &&
					Date.parse(candidate.expires_at) > now,
			);
			if (!session) refuse('memories_session_unavailable');

			const existing = this.items.find(
				(item) =>
					item.session_id === input.sessionId &&
					item.idempotency_key === input.idempotencyKey,
			);
			if (existing) {
				if (
					existing.mime_type !== input.mimeType ||
					Number(existing.size_bytes) !== input.sizeBytes ||
					existing.checksum_sha256 !== input.checksumSha256 ||
					existing.duration_seconds !== input.durationSeconds
				)
					refuse('memories_idempotency_conflict');
				return { ...existing };
			}

			const resident = this.items.filter((item) => item.object_deleted_at === null);
			const own = resident.filter((item) => item.session_id === input.sessionId);
			const bytesOf = (rows: MediaRow[]) =>
				rows.reduce((total, item) => total + Number(item.size_bytes), 0);
			const isVideo = input.mimeType.startsWith('video/');
			if (own.length >= space.maxSessionFiles) refuse('memories_session_file_quota');
			if (
				isVideo &&
				own.filter((item) => item.mime_type.startsWith('video/')).length >=
					space.maxSessionVideos
			)
				refuse('memories_session_video_quota');
			if (bytesOf(own) + input.sizeBytes > space.maxSessionBytes)
				refuse('memories_session_byte_quota');
			if (
				own.filter((item) => item.status === 'uploading' || item.status === 'validating')
					.length >= input.maxSessionInFlight
			)
				refuse('memories_session_concurrency_quota');
			if (resident.length >= space.maxEventObjects) refuse('memories_event_object_quota');
			if (bytesOf(resident) + input.sizeBytes > space.maxEventBytes)
				refuse('memories_event_byte_quota');

			const created = nowIso();
			const row: MediaRow = {
				id: randomUUID(),
				event_id: input.eventId,
				session_id: input.sessionId,
				object_key: input.objectKey,
				mime_type: input.mimeType,
				size_bytes: input.sizeBytes,
				checksum_sha256: input.checksumSha256,
				// numeric(10, 3): the column keeps three decimals whatever arrives.
				duration_seconds:
					input.durationSeconds === null
						? null
						: roundMemoriesVideoDurationSeconds(input.durationSeconds),
				caption: '',
				status: 'uploading',
				duplicate_of_id: null,
				created_at: created,
				updated_at: created,
				accepted_at: null,
				rejected_at: null,
				deleted_at: null,
				idempotency_key: input.idempotencyKey,
				cleanup_after: null,
				cleanup_claimed_at: null,
				cleanup_lease_id: null,
				object_deleted_at: null,
			};
			this.items.push(row);
			return { ...row };
		},

		releaseReservation: async (itemId: string, sessionId: string): Promise<boolean> => {
			const before = this.items.length;
			this.items = this.items.filter(
				(item) =>
					!(
						item.id === itemId &&
						item.session_id === sessionId &&
						item.status === 'uploading'
					),
			);
			return this.items.length < before;
		},

		claimValidation: async (itemId: string, sessionId: string): Promise<MediaRow | null> => {
			const row = this.row(itemId);
			if (!row || row.session_id !== sessionId || row.status !== 'uploading') return null;
			row.status = 'validating';
			row.updated_at = nowIso();
			return { ...row };
		},

		finalizeMedia: async (input: {
			itemId: string;
			sessionId: string;
			outcome: 'accepted' | 'rejected';
			cleanupAfter: string;
		}): Promise<MediaRow | null> => {
			const row = this.row(input.itemId);
			if (!row || row.session_id !== input.sessionId) return null;
			if (row.status !== 'validating') return { ...row };
			const now = nowIso();
			row.updated_at = now;
			if (input.outcome === 'rejected') {
				row.status = 'rejected';
				row.rejected_at = now;
				row.cleanup_after = input.cleanupAfter;
				return { ...row };
			}
			const winner = this.items.find(
				(item) =>
					item.id !== row.id &&
					item.event_id === row.event_id &&
					item.status === 'accepted' &&
					item.checksum_sha256 === row.checksum_sha256,
			);
			if (winner) {
				row.status = 'duplicate';
				row.duplicate_of_id = winner.id;
				row.cleanup_after = input.cleanupAfter;
			} else {
				row.status = 'accepted';
				row.accepted_at = now;
			}
			return { ...row };
		},

		findMediaById: async (eventId: string, itemId: string): Promise<MediaRow | null> => {
			const row = this.row(itemId);
			return row && row.event_id === eventId ? { ...row } : null;
		},

		listSessionMedia: async (eventId: string, sessionId: string): Promise<MediaRow[]> =>
			this.items
				.filter((item) => item.event_id === eventId && item.session_id === sessionId)
				.map((item) => ({ ...item })),

		listSessionInFlightMedia: async (eventId: string, sessionId: string): Promise<MediaRow[]> =>
			this.items
				.filter(
					(item) =>
						item.event_id === eventId &&
						item.session_id === sessionId &&
						(item.status === 'uploading' || item.status === 'validating') &&
						item.object_deleted_at === null,
				)
				.map((item) => ({ ...item })),

		patchMedia: async (
			itemId: string,
			body: Record<string, unknown>,
			extraFilter = '',
		): Promise<MediaRow | null> => {
			const row = this.row(itemId);
			if (!row) return null;
			const mustEqual = /status=eq\.([a-z]+)/.exec(extraFilter)?.[1];
			const mustDiffer = /status=neq\.([a-z]+)/.exec(extraFilter)?.[1];
			if (
				(mustEqual && row.status !== mustEqual) ||
				(mustDiffer && row.status === mustDiffer)
			)
				return null;
			Object.assign(row, body, { updated_at: nowIso() });
			return { ...row };
		},

		listStaleInFlightMedia: async (input: {
			status: 'uploading' | 'validating';
			cutoff: string;
			limit: number;
			after: StaleMediaCursor | null;
		}): Promise<MediaRow[]> => {
			const column = input.status === 'uploading' ? 'created_at' : 'updated_at';
			return this.items
				.filter(
					(item) =>
						item.status === input.status &&
						item.object_deleted_at === null &&
						item[column] < input.cutoff &&
						(!input.after ||
							item[column] > input.after.at ||
							(item[column] === input.after.at && item.id > input.after.id)),
				)
				.sort((a, b) => a[column].localeCompare(b[column]) || a.id.localeCompare(b.id))
				.slice(0, input.limit)
				.map((item) => ({ ...item }));
		},

		expireContent: async (now: string): Promise<number> => {
			if (!this.space || this.space.retentionEndsAt > now) return 0;
			const due = this.items.filter(
				(item) => item.object_deleted_at === null && item.cleanup_after === null,
			);
			for (const item of due) {
				item.status = 'deleted';
				item.deleted_at = item.deleted_at ?? now;
				item.updated_at = now;
				item.cleanup_after = now;
			}
			return due.length;
		},

		claimCleanup: async (input: {
			leaseId: string;
			batchSize: number;
			leaseSeconds: number;
		}): Promise<MediaRow[]> => {
			const now = Date.now();
			const claimed = this.items
				.filter(
					(item) =>
						item.cleanup_after !== null &&
						Date.parse(item.cleanup_after) <= now &&
						item.object_deleted_at === null &&
						(item.cleanup_claimed_at === null ||
							Date.parse(item.cleanup_claimed_at) < now - input.leaseSeconds * 1000),
				)
				.slice(0, input.batchSize);
			for (const item of claimed) {
				item.cleanup_claimed_at = nowIso();
				item.cleanup_lease_id = input.leaseId;
			}
			return claimed.map((item) => ({ ...item }));
		},

		markObjectDeleted: async (itemId: string, leaseId: string): Promise<void> => {
			const row = this.row(itemId);
			if (!row || row.cleanup_lease_id !== leaseId) return;
			Object.assign(row, {
				object_deleted_at: nowIso(),
				caption: '',
				cleanup_claimed_at: null,
				cleanup_lease_id: null,
				updated_at: nowIso(),
			});
		},

		listSessionsPendingAnonymization: async (
			now: string,
			limit: number,
		): Promise<{ id: string; event_id: string }[]> =>
			this.sessions
				.filter(
					(session) =>
						session.anonymized_at === null &&
						(session.expires_at <= now || session.revoked_at !== null),
				)
				.slice(0, limit)
				.map((session) => ({ id: session.id, event_id: session.event_id })),

		anonymizeSession: async (input: { sessionId: string }): Promise<boolean> => {
			const session = this.sessions.find((candidate) => candidate.id === input.sessionId);
			if (!session || session.anonymized_at !== null) return false;
			if (
				this.items.some(
					(item) => item.session_id === session.id && item.object_deleted_at === null,
				)
			)
				return false;
			session.display_name = 'Invitado retirado';
			session.revoked_at = session.revoked_at ?? nowIso();
			session.anonymized_at = nowIso();
			return true;
		},

		insertAudit: async (input: AuditRow): Promise<void> => {
			this.audit.push(input);
		},

		purgeAudit: async (cutoff: string): Promise<number> => {
			const before = this.audit.length;
			this.audit = this.audit.filter((row) => row.expiresAt > cutoff);
			return before - this.audit.length;
		},
	};
}

/** One catalog per test file: the `jest.mock` factory and the test share this instance. */
export const catalog = new InMemoryCatalog();

// Workers -----------------------------------------------------------------------------

function createNonceGuard(): NonNullable<MemoriesSignEnv['NONCE_GUARD']> {
	const used = new Set<string>();
	return {
		idFromName: (name: string) => ({ toString: () => name }),
		get: () => ({
			fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
				const claim = JSON.parse(String(init?.body)) as { key: string };
				if (used.has(claim.key)) return new Response(null, { status: 409 });
				used.add(claim.key);
				return new Response(null, { status: 204 });
			},
		}),
	};
}

/** Fixed-window limiter with the limit the Sign Worker is deployed with. */
function createRateLimiter(): MemoriesSignEnv['SIGN_RATE_LIMITER'] {
	const hits = new Map<string, { windowStart: number; count: number }>();
	return {
		limit: async ({ key }: { key: string }) => {
			const now = Date.now();
			const current = hits.get(key);
			if (
				!current ||
				now - current.windowStart >= MEMORIES_SIGN_RATE_LIMIT.periodSeconds * 1000
			) {
				hits.set(key, { windowStart: now, count: 1 });
				return { success: true };
			}
			current.count += 1;
			return { success: current.count <= MEMORIES_SIGN_RATE_LIMIT.limit };
		},
	};
}

export type NetworkFault = 'none' | 'drop_request' | 'lose_response';

export interface MemoriesStack {
	bucket: InMemoryBucket;
	/** Applied to the next browser PUT only, then reset to `none`. */
	nextUploadFault: NetworkFault;
	/** While true, the Retrieval Worker cannot be reached. */
	retrieveWorkerDown: boolean;
	/** Runs before every Worker request, e.g. to make the clock pay for network latency. */
	beforeRequest: (() => void) | null;
	restore(): void;
}

function toWorkerRequest(url: URL, init: RequestInit | undefined): Request {
	const headers = new Headers(init?.headers);
	const rawBody = init?.body;
	const bytes =
		typeof rawBody === 'string'
			? new TextEncoder().encode(rawBody)
			: rawBody instanceof Uint8Array
				? rawBody
				: null;
	if (bytes && !headers.has('Content-Length'))
		headers.set('Content-Length', String(bytes.byteLength));
	return {
		method: init?.method ?? 'GET',
		url: url.toString(),
		headers,
		body: bytes ? streamOf(bytes) : null,
	} as unknown as Request;
}

/**
 * Points the app at both Workers and replaces `fetch` with a router that runs
 * their real handlers. Signing keys are generated per stack.
 */
export function startMemoriesStack(): MemoriesStack {
	installWorkerRuntimeGlobals();
	const upload = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
	const retrieval = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
	const previousEnv = {
		[MEMORIES_ENV.uploadOrigin]: process.env[MEMORIES_ENV.uploadOrigin],
		[MEMORIES_ENV.retrievalOrigin]: process.env[MEMORIES_ENV.retrievalOrigin],
		[MEMORIES_ENV.uploadSigningPrivateKey]: process.env[MEMORIES_ENV.uploadSigningPrivateKey],
		[MEMORIES_ENV.retrievalSigningPrivateKey]:
			process.env[MEMORIES_ENV.retrievalSigningPrivateKey],
	};
	process.env[MEMORIES_ENV.uploadOrigin] = SIGN_WORKER_ORIGIN;
	process.env[MEMORIES_ENV.retrievalOrigin] = RETRIEVE_WORKER_ORIGIN;
	process.env[MEMORIES_ENV.uploadSigningPrivateKey] = upload.privateKey
		.export({ type: 'pkcs8', format: 'pem' })
		.toString();
	process.env[MEMORIES_ENV.retrievalSigningPrivateKey] = retrieval.privateKey
		.export({ type: 'pkcs8', format: 'pem' })
		.toString();

	const bucket = new InMemoryBucket();
	const signEnv: MemoriesSignEnv = {
		MEMORIES_BUCKET: bucket.binding,
		NONCE_GUARD: createNonceGuard(),
		MEMORIES_UPLOAD_CAPABILITY_SECRET: 'lifecycle-capability-secret',
		MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: upload.publicKey
			.export({ type: 'spki', format: 'pem' })
			.toString(),
		MEMORIES_STORAGE_TARGET: 'local',
		MEMORIES_ALLOWED_ORIGINS: BROWSER_ORIGIN,
		SIGN_RATE_LIMITER: createRateLimiter(),
	};
	const retrieveEnv: RetrieveEnv = {
		MEMORIES_BUCKET: bucket.binding,
		NONCE_GUARD: createNonceGuard(),
		MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY: retrieval.publicKey
			.export({ type: 'spki', format: 'pem' })
			.toString(),
		MEMORIES_STORAGE_TARGET: 'local',
	};

	const previousFetch = globalThis.fetch;
	const stack: MemoriesStack = {
		bucket,
		nextUploadFault: 'none',
		retrieveWorkerDown: false,
		beforeRequest: null,
		restore: () => {
			globalThis.fetch = previousFetch;
			for (const [name, value] of Object.entries(previousEnv)) {
				if (value === undefined) delete process.env[name];
				else process.env[name] = value;
			}
		},
	};

	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
		stack.beforeRequest?.();
		if (stack.retrieveWorkerDown && url.origin === RETRIEVE_WORKER_ORIGIN)
			throw new TypeError('fetch failed');
		const isBrowserUpload = init?.method === 'PUT';
		const fault = isBrowserUpload ? stack.nextUploadFault : 'none';
		if (isBrowserUpload) stack.nextUploadFault = 'none';
		if (fault === 'drop_request') throw new TypeError('Load failed');
		const request = toWorkerRequest(url, init);
		let response: Response;
		if (url.origin === SIGN_WORKER_ORIGIN) response = await signWorker.fetch(request, signEnv);
		else if (url.origin === RETRIEVE_WORKER_ORIGIN)
			response = await retrieveWorker.fetch(request, retrieveEnv);
		else throw new TypeError(`Unexpected request to ${url.origin}`);
		// The Worker did its work; the answer never reaches the phone.
		if (fault === 'lose_response') throw new TypeError('Load failed');
		return response;
	}) as typeof fetch;

	return stack;
}

// Media ---------------------------------------------------------------------------------

export function ascii(text: string): number[] {
	return Array.from(text, (character) => character.charCodeAt(0));
}

export function box(type: string, totalBytes: number, fill = 0): Uint8Array {
	const bytes = new Uint8Array(totalBytes).fill(fill, 8);
	new DataView(bytes.buffer).setUint32(0, totalBytes);
	bytes.set(ascii(type), 4);
	return bytes;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
	const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}
	return bytes;
}

export type MediaSample = { bytes: Uint8Array; mimeType: string; durationSeconds?: number };

/** JPEG signature followed by filler; `seed` makes the bytes (and checksum) distinct. */
export function jpegPhoto(seed: number, totalBytes = 4096): MediaSample {
	const bytes = new Uint8Array(totalBytes).fill(seed);
	bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
	return { bytes, mimeType: 'image/jpeg' };
}

export function pngBytes(): Uint8Array {
	const bytes = new Uint8Array(64);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	return bytes;
}

/** HEIC as an iPhone stores it: an `ftyp` box with the `heic` brand. */
export function heicPhoto(seed: number): MediaSample {
	const ftyp = box('ftyp', 24);
	ftyp.set(ascii('heic'), 8);
	return { bytes: concat(ftyp, box('mdat', 2048, seed)), mimeType: 'image/heic' };
}

/**
 * QuickTime clip laid out like a phone recording: media data first, then a
 * `moov` atom whose sample tables are larger than the Worker's read window.
 */
export function phoneVideo(input: {
	seed: number;
	durationSeconds: number;
	moovBytes: number;
	mimeType?: 'video/quicktime' | 'video/mp4';
}): MediaSample {
	const ftyp = box('ftyp', 32);
	ftyp.set(ascii(input.mimeType === 'video/mp4' ? 'isom' : 'qt  '), 8);
	const moov = new Uint8Array(input.moovBytes);
	const view = new DataView(moov.buffer);
	view.setUint32(0, input.moovBytes);
	moov.set(ascii('moov'), 4);
	view.setUint32(8, 40);
	moov.set(ascii('mvhd'), 12);
	// Version 0 header: a microsecond timescale keeps a fractional duration exact.
	view.setUint32(28, 1_000_000);
	view.setUint32(32, Math.round(input.durationSeconds * 1_000_000));
	if (input.moovBytes > 48) moov.set(box('trak', input.moovBytes - 48), 48);
	return {
		bytes: concat(ftyp, box('wide', 8), box('mdat', 200 * 1024, input.seed), moov),
		mimeType: input.mimeType ?? 'video/quicktime',
		durationSeconds: input.durationSeconds,
	};
}
