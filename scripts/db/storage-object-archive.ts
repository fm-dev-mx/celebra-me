import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export interface StorageObjectArchiveEntry {
	bucketId: string;
	name: string;
	contentType: string | null;
	bytes: number;
	sha256: string;
	contentBase64: string;
}

export interface StorageObjectArchive {
	version: 1;
	createdAt: string;
	objects: StorageObjectArchiveEntry[];
}

export function classifyStorageDownloadFailure(
	body: string,
): 'not_found' | 'invalid_request' | 'unknown' {
	const normalized = body.toLowerCase();
	if (normalized.includes('not found') || normalized.includes('not_found')) return 'not_found';
	if (normalized.includes('invalid') || normalized.includes('bad request')) {
		return 'invalid_request';
	}
	return 'unknown';
}

export interface MaterializedStorageObject {
	bucketId: string;
	name: string;
	path: string;
	bytes: number;
	sha256: string;
}

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function assertSafeSegment(value: string, label: string): void {
	if (!value || value.includes('\0') || value === '.' || value === '..') {
		throw new Error(`Invalid Storage ${label}.`);
	}
}

function resolveObjectPath(root: string, bucketId: string, name: string): string {
	assertSafeSegment(bucketId, 'bucket');
	if (bucketId.includes('/') || bucketId.includes('\\')) {
		throw new Error('Invalid Storage bucket.');
	}
	const objectSegments = name.replaceAll('\\', '/').split('/');
	for (const segment of objectSegments) assertSafeSegment(segment, 'object name');
	const rootPath = resolve(root);
	const target = resolve(rootPath, bucketId, ...objectSegments);
	if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`)) {
		throw new Error(`Storage object path escapes restore root: ${bucketId}/${name}`);
	}
	return target;
}

export function createStorageObjectArchiveEntry(
	bucketId: string,
	name: string,
	content: Uint8Array,
	contentType: string | null = null,
): StorageObjectArchiveEntry {
	if (content.byteLength === 0) {
		throw new Error(`Storage object is empty: ${bucketId}/${name}`);
	}
	resolveObjectPath(process.cwd(), bucketId, name);
	return {
		bucketId,
		name,
		contentType,
		bytes: content.byteLength,
		sha256: sha256(content),
		contentBase64: Buffer.from(content).toString('base64'),
	};
}

export function validateStorageObjectArchive(archive: StorageObjectArchive): void {
	if (archive.version !== 1 || !Array.isArray(archive.objects)) {
		throw new Error('Unsupported Storage object archive.');
	}
	const identities = new Set<string>();
	for (const object of archive.objects) {
		const identity = `${object.bucketId}/${object.name}`;
		if (identities.has(identity)) throw new Error(`Duplicate Storage object: ${identity}`);
		identities.add(identity);
		resolveObjectPath(process.cwd(), object.bucketId, object.name);
		const content = Buffer.from(object.contentBase64, 'base64');
		if (content.byteLength === 0 || content.byteLength !== object.bytes) {
			throw new Error(`Storage object size mismatch: ${identity}`);
		}
		if (sha256(content) !== object.sha256) {
			throw new Error(`Storage object checksum mismatch: ${identity}`);
		}
	}
}

export function readStorageObjectArchive(path: string): StorageObjectArchive {
	const archive = JSON.parse(readFileSync(path, 'utf8')) as StorageObjectArchive;
	validateStorageObjectArchive(archive);
	return archive;
}

export function writeStorageObjectArchive(path: string, archive: StorageObjectArchive): void {
	validateStorageObjectArchive(archive);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(archive, null, 2)}\n`, { mode: 0o600 });
}

export function materializeStorageObjectArchive(
	archive: StorageObjectArchive,
	targetRoot: string,
): MaterializedStorageObject[] {
	validateStorageObjectArchive(archive);
	return archive.objects.map((object) => {
		const target = resolveObjectPath(targetRoot, object.bucketId, object.name);
		const content = Buffer.from(object.contentBase64, 'base64');
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, content, { mode: 0o600 });
		const restored = readFileSync(target);
		const restoredHash = sha256(restored);
		if (restored.byteLength !== object.bytes || restoredHash !== object.sha256) {
			throw new Error(
				`Restored Storage object verification failed: ${object.bucketId}/${object.name}`,
			);
		}
		return {
			bucketId: object.bucketId,
			name: object.name,
			path: target,
			bytes: restored.byteLength,
			sha256: restoredHash,
		};
	});
}
