import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { Decrypter, Encrypter, generateIdentity, identityToRecipient } from 'age-encryption';
import { AwsClient } from 'aws4fetch';
import {
	CRITICAL_BACKUP_KINDS,
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
} from './backup-manifest.ts';
import { getSecretFromEnvOrFiles, PROD_SECRET_FILES } from './db-target-config.ts';

/**
 * Off-site copy of a verified critical backup: one age-encrypted bundle per recovery point,
 * uploaded to a Cloudflare R2 bucket through its S3-compatible API. The bucket owns retention
 * (lifecycle rule) and deletion protection (Bucket Lock); this module never deletes objects.
 */

const BUNDLE_MAGIC = 'CELEBRA-OFFSITE-BUNDLE-V1\n';
const MANIFEST_ENTRY = 'manifest.json';
export const OFFSITE_OBJECT_SUFFIX = '.bundle.age';
export const OFFSITE_PREFIXES = ['daily', 'test'] as const;
export type OffsitePrefix = (typeof OFFSITE_PREFIXES)[number];

export const OFFSITE_ENV = {
	accountId: 'PROD_OFFSITE_R2_ACCOUNT_ID',
	bucket: 'PROD_OFFSITE_R2_BUCKET',
	accessKeyId: 'PROD_OFFSITE_R2_ACCESS_KEY_ID',
	secretAccessKey: 'PROD_OFFSITE_R2_SECRET_ACCESS_KEY',
	recipient: 'PROD_OFFSITE_AGE_RECIPIENT',
} as const;

export interface OffsiteConfig {
	accountId: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	recipient: string;
}

export interface OffsiteObject {
	key: string;
	bytes: number;
	lastModified: string;
}

interface BundleEntry {
	name: string;
	bytes: number;
	sha256: string;
}

interface BundleHeader {
	version: 1;
	entries: BundleEntry[];
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Reads the off-site settings from the shell or `.env.production.local`.
 * Returns null when none is set (feature not configured yet); a partial set fails closed.
 */
export function readOffsiteConfig(
	read: (name: string) => string = (name) => getSecretFromEnvOrFiles(name, PROD_SECRET_FILES),
): OffsiteConfig | null {
	const values = Object.fromEntries(
		Object.entries(OFFSITE_ENV).map(([field, name]) => [field, read(name).trim()]),
	) as unknown as OffsiteConfig;
	const missing = Object.entries(OFFSITE_ENV)
		.filter(([field]) => !values[field as keyof OffsiteConfig])
		.map(([, name]) => name);
	if (missing.length === Object.keys(OFFSITE_ENV).length) return null;
	if (missing.length > 0) {
		throw new Error(`Off-site backup is partially configured. Missing: ${missing.join(', ')}.`);
	}
	if (!/^[0-9a-f]{32}$/.test(values.accountId)) {
		throw new Error(`${OFFSITE_ENV.accountId} must be the 32-character Cloudflare account id.`);
	}
	if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(values.bucket)) {
		throw new Error(`${OFFSITE_ENV.bucket} is not a valid R2 bucket name.`);
	}
	if (!values.recipient.startsWith('age1')) {
		throw new Error(`${OFFSITE_ENV.recipient} must be an age public key (age1...).`);
	}
	return values;
}

/** `daily/2026-10-16/critical-2026-10-16T10-00-17-004Z.bundle.age` */
export function offsiteObjectKey(prefix: OffsitePrefix, createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) throw new Error('Backup manifest has an invalid createdAt.');
	const iso = date.toISOString();
	return `${prefix}/${iso.slice(0, 10)}/critical-${iso.replace(/[:.]/g, '-')}${OFFSITE_OBJECT_SUFFIX}`;
}

/**
 * Packs a verified critical backup (manifest plus every artifact) into one byte array.
 * Artifact paths become bare file names; checksums are re-verified while reading.
 */
export function createOffsiteBundle(manifestPath: string): {
	bundle: Uint8Array;
	manifest: CriticalBackupManifest;
} {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
	validateCriticalBackupManifest(manifest, { allowDisposableTest: true });
	const names = new Set<string>([MANIFEST_ENTRY]);
	const files: Array<{ name: string; data: Uint8Array }> = [];
	const portableArtifacts = manifest.artifacts.map((artifact) => {
		const name = basename(artifact.path);
		if (names.has(name)) throw new Error(`Duplicate artifact file name in bundle: ${name}`);
		names.add(name);
		const data = readFileSync(artifact.path);
		if (data.byteLength !== artifact.bytes || sha256(data) !== artifact.sha256) {
			throw new Error(`Artifact changed after the manifest was written: ${artifact.kind}`);
		}
		files.push({ name, data });
		return { ...artifact, path: name };
	});
	const manifestBytes = Buffer.from(
		`${JSON.stringify({ ...manifest, artifacts: portableArtifacts }, null, 2)}\n`,
	);
	files.unshift({ name: MANIFEST_ENTRY, data: manifestBytes });

	const header: BundleHeader = {
		version: 1,
		entries: files.map(({ name, data }) => ({
			name,
			bytes: data.byteLength,
			sha256: sha256(data),
		})),
	};
	const headerBytes = Buffer.from(JSON.stringify(header));
	const headerLength = Buffer.alloc(4);
	headerLength.writeUInt32BE(headerBytes.byteLength);
	const bundle = Buffer.concat([
		Buffer.from(BUNDLE_MAGIC),
		headerLength,
		headerBytes,
		...files.map(({ data }) => data),
	]);
	return { bundle: new Uint8Array(bundle), manifest };
}

/**
 * Unpacks a bundle into an empty directory, verifies every checksum, and rewrites the manifest
 * so its artifact paths point at the extracted files. Returns the rewritten manifest path.
 */
export function extractOffsiteBundle(bundle: Uint8Array, outputDir: string): string {
	const buffer = Buffer.from(bundle.buffer, bundle.byteOffset, bundle.byteLength);
	const magic = Buffer.from(BUNDLE_MAGIC);
	if (
		buffer.byteLength < magic.byteLength + 4 ||
		!buffer.subarray(0, magic.byteLength).equals(magic)
	) {
		throw new Error('Not a Celebra-me off-site backup bundle.');
	}
	const headerLength = buffer.readUInt32BE(magic.byteLength);
	const headerStart = magic.byteLength + 4;
	const header = JSON.parse(
		buffer.subarray(headerStart, headerStart + headerLength).toString('utf8'),
	) as BundleHeader;
	if (header.version !== 1 || !Array.isArray(header.entries)) {
		throw new Error('Unsupported off-site bundle header.');
	}

	const target = resolve(outputDir);
	if (existsSync(target) && readdirSync(target).length > 0) {
		throw new Error(`Restore directory must be empty: ${target}`);
	}
	mkdirSync(target, { recursive: true });

	let offset = headerStart + headerLength;
	const extracted = new Map<string, string>();
	for (const entry of header.entries) {
		if (entry.name !== basename(entry.name) || entry.name.startsWith('.')) {
			throw new Error(`Unsafe file name in bundle: ${entry.name}`);
		}
		const data = buffer.subarray(offset, offset + entry.bytes);
		offset += entry.bytes;
		if (data.byteLength !== entry.bytes || sha256(data) !== entry.sha256) {
			throw new Error(`Bundle entry is truncated or corrupted: ${entry.name}`);
		}
		const path = resolve(target, entry.name);
		writeFileSync(path, data, { mode: 0o600 });
		extracted.set(entry.name, path);
	}
	if (offset !== buffer.byteLength) throw new Error('Off-site bundle has trailing bytes.');

	const manifestPath = extracted.get(MANIFEST_ENTRY);
	if (!manifestPath) throw new Error('Off-site bundle has no manifest.');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
	const restored: CriticalBackupManifest = {
		...manifest,
		artifacts: manifest.artifacts.map((artifact) => {
			const path = extracted.get(artifact.path);
			if (!path) throw new Error(`Bundle is missing artifact file: ${artifact.kind}`);
			return { ...artifact, path };
		}),
	};
	for (const kind of CRITICAL_BACKUP_KINDS) {
		if (!restored.artifacts.some((artifact) => artifact.kind === kind)) {
			throw new Error(`Bundle manifest is missing artifact kind: ${kind}`);
		}
	}
	writeFileSync(manifestPath, `${JSON.stringify(restored, null, 2)}\n`, { mode: 0o600 });
	validateCriticalBackupManifest(restored, { allowDisposableTest: true });
	return manifestPath;
}

export async function encryptForRecipient(
	data: Uint8Array,
	recipient: string,
): Promise<Uint8Array> {
	const encrypter = new Encrypter();
	encrypter.addRecipient(recipient);
	return encrypter.encrypt(data);
}

export async function decryptWithIdentity(data: Uint8Array, identity: string): Promise<Uint8Array> {
	const decrypter = new Decrypter();
	decrypter.addIdentity(identity);
	return decrypter.decrypt(data, 'uint8array');
}

/** Reads the first `AGE-SECRET-KEY-` line of an identity file (comments are ignored). */
export function readIdentityFile(path: string): string {
	const identity = readFileSync(path, 'utf8')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.startsWith('AGE-SECRET-KEY-'));
	if (!identity) throw new Error('Identity file has no AGE-SECRET-KEY line.');
	return identity;
}

export async function generateOffsiteKeyPair(): Promise<{ identity: string; recipient: string }> {
	const identity = await generateIdentity();
	return { identity, recipient: await identityToRecipient(identity) };
}

type Fetch = typeof fetch;

function createClient(config: OffsiteConfig): AwsClient {
	return new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		service: 's3',
		region: 'auto',
	});
}

function objectUrl(config: OffsiteConfig, key = ''): string {
	const path = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${path}`;
}

async function signedFetch(
	config: OffsiteConfig,
	url: string,
	init: RequestInit,
	fetchImpl: Fetch,
): Promise<Response> {
	const request = await createClient(config).sign(url, init);
	return fetchImpl(request, { signal: AbortSignal.timeout(300_000) });
}

async function failure(action: string, response: Response): Promise<Error> {
	const body = await response.text().catch(() => '');
	const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
	return new Error(`R2 ${action} failed: HTTP ${response.status}${code ? ` (${code})` : ''}.`);
}

/** Uploads a new object; never overwrites an existing key. Verifies the stored size. */
export async function uploadOffsiteObject(
	config: OffsiteConfig,
	key: string,
	body: Uint8Array,
	fetchImpl: Fetch = fetch,
): Promise<void> {
	const url = objectUrl(config, key);
	const put = await signedFetch(
		config,
		url,
		{
			method: 'PUT',
			// Copy into an ArrayBuffer-backed view; fetch's BodyInit rejects SharedArrayBuffer views.
			body: new Uint8Array(body),
			headers: {
				'content-type': 'application/octet-stream',
				'if-none-match': '*',
				'x-amz-content-sha256': sha256(body),
			},
		},
		fetchImpl,
	);
	if (!put.ok) throw await failure('upload', put);
	const head = await signedFetch(config, url, { method: 'HEAD' }, fetchImpl);
	if (!head.ok) throw await failure('upload check', head);
	const stored = Number(head.headers.get('content-length'));
	if (stored !== body.byteLength) {
		throw new Error(`R2 upload check failed: stored ${stored} bytes, sent ${body.byteLength}.`);
	}
}

export async function downloadOffsiteObject(
	config: OffsiteConfig,
	key: string,
	fetchImpl: Fetch = fetch,
): Promise<Uint8Array> {
	const response = await signedFetch(
		config,
		objectUrl(config, key),
		{ method: 'GET' },
		fetchImpl,
	);
	if (!response.ok) throw await failure('download', response);
	return new Uint8Array(await response.arrayBuffer());
}

function decodeXml(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

export function parseListObjectsXml(xml: string): {
	objects: OffsiteObject[];
	nextToken: string | null;
} {
	const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, block]) => ({
		key: decodeXml(/<Key>([^<]*)<\/Key>/.exec(block)?.[1] ?? ''),
		bytes: Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? 0),
		lastModified: /<LastModified>([^<]*)<\/LastModified>/.exec(block)?.[1] ?? '',
	}));
	const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
	const token = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
	return { objects, nextToken: truncated && token ? decodeXml(token) : null };
}

/** Lists bundles under a prefix, newest key first (keys sort by recovery-point time). */
export async function listOffsiteObjects(
	config: OffsiteConfig,
	prefix: OffsitePrefix,
	fetchImpl: Fetch = fetch,
): Promise<OffsiteObject[]> {
	const objects: OffsiteObject[] = [];
	let token: string | null = null;
	do {
		const query = new URLSearchParams({ 'list-type': '2', prefix: `${prefix}/` });
		if (token) query.set('continuation-token', token);
		const response = await signedFetch(
			config,
			`${objectUrl(config)}?${query.toString()}`,
			{ method: 'GET' },
			fetchImpl,
		);
		if (!response.ok) throw await failure('list', response);
		const page = parseListObjectsXml(await response.text());
		objects.push(...page.objects);
		token = page.nextToken;
	} while (token);
	return objects
		.filter((object) => object.key.endsWith(OFFSITE_OBJECT_SUFFIX))
		.sort((left, right) => right.key.localeCompare(left.key));
}

/** Encrypts and uploads one verified critical backup. Returns the object key. */
export async function copyBackupOffsite(
	config: OffsiteConfig,
	manifestPath: string,
	prefix: OffsitePrefix,
	fetchImpl: Fetch = fetch,
): Promise<{ key: string; bytes: number }> {
	const { bundle, manifest } = createOffsiteBundle(manifestPath);
	const encrypted = await encryptForRecipient(bundle, config.recipient);
	const key = offsiteObjectKey(prefix, manifest.createdAt);
	await uploadOffsiteObject(config, key, encrypted, fetchImpl);
	return { key, bytes: encrypted.byteLength };
}
