/**
 * @jest-environment node
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createArtifactManifest,
	CRITICAL_BACKUP_KINDS,
	type CriticalBackupManifest,
} from '../../scripts/db/backup-manifest';
import {
	createOffsiteBundle,
	decryptWithIdentity,
	encryptForRecipient,
	extractOffsiteBundle,
	generateOffsiteKeyPair,
	offsiteObjectKey,
	OFFSITE_ENV,
	parseListObjectsXml,
	readIdentityFile,
	readOffsiteConfig,
	uploadOffsiteObject,
	type OffsiteConfig,
} from '../../scripts/db/offsite-backup';

const config: OffsiteConfig = {
	accountId: '05cb212a366549f0f93e7101c4ca3692',
	bucket: 'celebra-me-prod-backups',
	accessKeyId: 'test-access-key',
	secretAccessKey: 'test-secret-key',
	recipient: 'age1testrecipient',
};

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'celebra-offsite-'));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function writeBackup(): string {
	const sourceDir = join(root, 'critical-2026-10-16T10-00-17-004Z');
	mkdirSync(sourceDir);
	const artifacts = CRITICAL_BACKUP_KINDS.map((kind) => {
		const path = join(sourceDir, `${kind}.dump`);
		writeFileSync(path, `${kind} fixture payload `.repeat(8));
		return createArtifactManifest(kind, path);
	});
	const manifest: CriticalBackupManifest = {
		version: 1,
		createdAt: '2026-10-16T10:00:17.004Z',
		environment: 'disposable-test',
		projectRef: 'fixture',
		artifacts,
	};
	const manifestPath = join(sourceDir, 'manifest.json');
	writeFileSync(manifestPath, JSON.stringify(manifest));
	return manifestPath;
}

describe('off-site backup configuration', () => {
	it('treats a fully empty configuration as not configured', () => {
		expect(readOffsiteConfig(() => '')).toBeNull();
	});

	it('fails closed on a partial configuration', () => {
		expect(() =>
			readOffsiteConfig((name) =>
				name === OFFSITE_ENV.bucket ? 'celebra-me-prod-backups' : '',
			),
		).toThrow(/partially configured.*CELEBRA_OFFSITE_R2_ACCOUNT_ID/);
	});

	it('rejects a recipient that is not an age public key', () => {
		const values: Record<string, string> = {
			[OFFSITE_ENV.accountId]: config.accountId,
			[OFFSITE_ENV.bucket]: config.bucket,
			[OFFSITE_ENV.accessKeyId]: 'key',
			[OFFSITE_ENV.secretAccessKey]: 'secret',
			[OFFSITE_ENV.recipient]: 'AGE-SECRET-KEY-1ABC',
		};
		expect(() => readOffsiteConfig((name) => values[name] ?? '')).toThrow(/age public key/);
	});

	it('names objects by prefix, day and recovery-point time', () => {
		expect(offsiteObjectKey('daily', '2026-10-16T10:00:17.004Z')).toBe(
			'daily/2026-10-16/critical-2026-10-16T10-00-17-004Z.bundle.age',
		);
	});
});

describe('off-site backup bundle', () => {
	it('round-trips a backup through encryption and rewrites artifact paths', async () => {
		const manifestPath = writeBackup();
		const { bundle } = createOffsiteBundle(manifestPath);
		const { identity, recipient } = await generateOffsiteKeyPair();
		const encrypted = await encryptForRecipient(bundle, recipient);
		expect(Buffer.from(encrypted).includes(Buffer.from('database fixture payload'))).toBe(
			false,
		);

		const restoredPath = extractOffsiteBundle(
			await decryptWithIdentity(encrypted, identity),
			join(root, 'restored'),
		);
		const restored = JSON.parse(readFileSync(restoredPath, 'utf8')) as CriticalBackupManifest;
		const original = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
		expect(restored.artifacts.map((artifact) => artifact.sha256)).toEqual(
			original.artifacts.map((artifact) => artifact.sha256),
		);
		for (const artifact of restored.artifacts) {
			expect(artifact.path.startsWith(join(root, 'restored'))).toBe(true);
		}
	});

	it('cannot be decrypted with a different key', async () => {
		const { bundle } = createOffsiteBundle(writeBackup());
		const owner = await generateOffsiteKeyPair();
		const stranger = await generateOffsiteKeyPair();
		const encrypted = await encryptForRecipient(bundle, owner.recipient);
		await expect(decryptWithIdentity(encrypted, stranger.identity)).rejects.toThrow();
	});

	it('refuses an artifact that changed after the manifest was written', () => {
		const manifestPath = writeBackup();
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
		writeFileSync(manifest.artifacts[0]!.path, 'tampered artifact payload '.repeat(8));
		expect(() => createOffsiteBundle(manifestPath)).toThrow(/mismatch/);
	});

	it('refuses a corrupted bundle and a non-empty restore directory', () => {
		const { bundle } = createOffsiteBundle(writeBackup());
		const corrupted = Uint8Array.from(bundle);
		corrupted[corrupted.length - 1] = corrupted[corrupted.length - 1]! ^ 0xff;
		expect(() => extractOffsiteBundle(corrupted, join(root, 'corrupted'))).toThrow(
			/truncated or corrupted/,
		);
		writeFileSync(join(root, 'occupied.txt'), 'x');
		expect(() => extractOffsiteBundle(bundle, root)).toThrow(/must be empty/);
	});

	it('reads the secret line from an age identity file', async () => {
		const { identity } = await generateOffsiteKeyPair();
		const path = join(root, 'key.txt');
		writeFileSync(path, `# created today\n# public key: age1x\n${identity}\n`);
		expect(readIdentityFile(path)).toBe(identity);
	});
});

describe('off-site backup R2 client', () => {
	it('uploads without overwriting and verifies the stored size', async () => {
		const requests: Request[] = [];
		const fetchImpl = (async (request: Request) => {
			requests.push(request);
			return request.method === 'PUT'
				? new Response(null, { status: 200 })
				: new Response(null, { status: 200, headers: { 'content-length': '3' } });
		}) as unknown as typeof fetch;

		await uploadOffsiteObject(
			config,
			'test/2026-10-16/a.bundle.age',
			Uint8Array.of(1, 2, 3),
			fetchImpl,
		);

		expect(requests.map((request) => request.method)).toEqual(['PUT', 'HEAD']);
		expect(requests[0]!.url).toBe(
			'https://05cb212a366549f0f93e7101c4ca3692.r2.cloudflarestorage.com/celebra-me-prod-backups/test/2026-10-16/a.bundle.age',
		);
		expect(requests[0]!.headers.get('if-none-match')).toBe('*');
		expect(requests[0]!.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
	});

	it('fails when the stored size differs from what was sent', async () => {
		const fetchImpl = (async (request: Request) =>
			request.method === 'PUT'
				? new Response(null, { status: 200 })
				: new Response(null, {
						status: 200,
						headers: { 'content-length': '1' },
					})) as unknown as typeof fetch;
		await expect(
			uploadOffsiteObject(config, 'test/a.bundle.age', Uint8Array.of(1, 2, 3), fetchImpl),
		).rejects.toThrow(/stored 1 bytes, sent 3/);
	});

	it('reports the R2 error code without echoing the response body', async () => {
		const fetchImpl = (async () =>
			new Response(
				'<Error><Code>AccessDenied</Code><Message>secret detail</Message></Error>',
				{
					status: 403,
				},
			)) as unknown as typeof fetch;
		await expect(
			uploadOffsiteObject(config, 'test/a.bundle.age', Uint8Array.of(1), fetchImpl),
		).rejects.toThrow('R2 upload failed: HTTP 403 (AccessDenied).');
	});

	it('parses a truncated object listing', () => {
		const page = parseListObjectsXml(
			'<ListBucketResult><IsTruncated>true</IsTruncated>' +
				'<Contents><Key>daily/2026-10-16/a&amp;b.bundle.age</Key><Size>42</Size>' +
				'<LastModified>2026-10-16T10:01:00.000Z</LastModified></Contents>' +
				'<NextContinuationToken>next==</NextContinuationToken></ListBucketResult>',
		);
		expect(page).toEqual({
			objects: [
				{
					key: 'daily/2026-10-16/a&b.bundle.age',
					bytes: 42,
					lastModified: '2026-10-16T10:01:00.000Z',
				},
			],
			nextToken: 'next==',
		});
	});
});
