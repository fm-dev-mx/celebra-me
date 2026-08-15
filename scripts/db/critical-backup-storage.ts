/**
 * Critical-backup Storage inventory and bounded-parallel download.
 * Inventory uses invitation_assets + storage.objects identity, not JSON LIKE.
 */
import { createHash } from 'node:crypto';
import {
	classifyStorageDownloadFailure,
	createStorageObjectArchiveEntry,
	type StorageObjectArchive,
	type StorageObjectArchiveEntry,
} from './storage-object-archive.ts';

export const STORAGE_DOWNLOAD_CONCURRENCY = 6;

export const STORAGE_INVENTORY_SQL = `select coalesce(json_agg(source order by "bucketId", name), '[]'::json)::text
		 from (
		   select distinct on (bucket_id, object_name)
		          bucket_id as "bucketId", object_name as name, content_type as "contentType",
		          declared_bytes as "declaredBytes", declared_sha256 as "declaredSha256"
		   from (
		     select a.bucket as bucket_id, a.storage_path as object_name,
		            coalesce(a.mime_type, o.metadata->>'mimetype') as content_type,
		            a.file_size as declared_bytes, a.sha256 as declared_sha256, 0 as priority
		     from public.invitation_assets a
		     left join storage.objects o on o.bucket_id = a.bucket and o.name = a.storage_path
		     where a.deleted_at is null and a.provider = 'supabase'
		     union all
		     select o.bucket_id, o.name, o.metadata->>'mimetype',
		            nullif(o.metadata->>'size', '')::bigint, null::text, 1
		     from storage.objects o
		     where o.bucket_id = 'invitation-assets'
		   ) candidates
		   order by bucket_id, object_name, priority
		 ) source`;

export interface StorageInventoryRow {
	bucketId: string;
	name: string;
	contentType: string | null;
	declaredBytes: number | string | null;
	declaredSha256: string | null;
}

function parseNumeric(value: number | string | null): number | null {
	if (value === null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function storageObjectRef(bucketId: string, name: string): string {
	return createHash('sha256').update(`${bucketId}/${name}`).digest('hex').slice(0, 16);
}

async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const limit = Math.max(1, Math.min(concurrency, items.length || 1));
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker(): Promise<void> {
		for (;;) {
			const index = next;
			next += 1;
			if (index >= items.length) return;
			results[index] = await fn(items[index]!, index);
		}
	}
	await Promise.all(Array.from({ length: limit }, () => worker()));
	return results;
}

export async function downloadStorageInventory(input: {
	inventory: readonly StorageInventoryRow[];
	prodSupabaseUrl: string;
	prodServiceRole: string;
	concurrency?: number;
	fetchImpl?: typeof fetch;
	onProgress?: (index: number, total: number) => void;
}): Promise<StorageObjectArchiveEntry[]> {
	const fetchFn = input.fetchImpl ?? fetch;
	const total = input.inventory.length;
	const apiOrigin = input.prodSupabaseUrl.replace(/\/$/, '');
	const entries = await mapPool(
		input.inventory,
		input.concurrency ?? STORAGE_DOWNLOAD_CONCURRENCY,
		async (object, index) => {
			input.onProgress?.(index + 1, total);
			const objectRef = storageObjectRef(object.bucketId, object.name);
			const encodedPath = object.name.split('/').map(encodeURIComponent).join('/');
			const response = await fetchFn(
				`${apiOrigin}/storage/v1/object/public/${encodeURIComponent(object.bucketId)}/${encodedPath}`,
				{
					headers: {
						Authorization: `Bearer ${input.prodServiceRole}`,
						apikey: input.prodServiceRole,
					},
				},
			);
			if (!response.ok) {
				const failureCategory = classifyStorageDownloadFailure(await response.text());
				throw new Error(
					`Critical Storage object download failed (${response.status}, ${failureCategory}, ref ${objectRef}).`,
				);
			}
			const content = new Uint8Array(await response.arrayBuffer());
			const entry = createStorageObjectArchiveEntry(
				object.bucketId,
				object.name,
				content,
				object.contentType,
			);
			const declaredBytes = parseNumeric(object.declaredBytes);
			if (declaredBytes !== null && declaredBytes !== entry.bytes) {
				throw new Error(`Storage object size mismatch (ref ${objectRef}).`);
			}
			if (object.declaredSha256 && object.declaredSha256 !== entry.sha256) {
				throw new Error(`Storage object checksum mismatch (ref ${objectRef}).`);
			}
			return entry;
		},
	);
	return entries;
}

export function emptyStorageArchive(createdAt = new Date().toISOString()): StorageObjectArchive {
	return { version: 1, createdAt, objects: [] };
}
