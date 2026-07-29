import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createStorageObjectArchiveEntry,
	materializeStorageObjectArchive,
	validateStorageObjectArchive,
	type StorageObjectArchive,
} from '../../scripts/db/storage-object-archive';

describe('Storage object recovery archive', () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	it('materializes and verifies actual object bytes', () => {
		const root = mkdtempSync(join(tmpdir(), 'celebra-storage-restore-'));
		roots.push(root);
		const content = Buffer.from('critical invitation object bytes'.repeat(8));
		const entry = createStorageObjectArchiveEntry(
			'invitation-assets',
			'invitation/hero.webp',
			content,
			'image/webp',
		);
		const archive: StorageObjectArchive = {
			version: 1,
			createdAt: '2026-07-29T12:00:00.000Z',
			objects: [entry],
		};
		const [restored] = materializeStorageObjectArchive(archive, root);
		expect(restored).toMatchObject({
			bucketId: 'invitation-assets',
			name: 'invitation/hero.webp',
			bytes: content.byteLength,
			sha256: entry.sha256,
		});
		expect(readFileSync(restored!.path)).toEqual(content);
	});

	it('rejects corrupted bytes and duplicate identities', () => {
		const entry = createStorageObjectArchiveEntry(
			'invitation-assets',
			'invitation/hero.webp',
			Buffer.from('critical invitation object bytes'.repeat(8)),
		);
		const corrupted = structuredClone(entry);
		corrupted.contentBase64 = Buffer.from('different bytes'.repeat(20)).toString('base64');
		expect(() =>
			validateStorageObjectArchive({
				version: 1,
				createdAt: '2026-07-29T12:00:00.000Z',
				objects: [corrupted],
			}),
		).toThrow(/size mismatch|checksum mismatch/);
		expect(() =>
			validateStorageObjectArchive({
				version: 1,
				createdAt: '2026-07-29T12:00:00.000Z',
				objects: [entry, entry],
			}),
		).toThrow(/Duplicate/);
	});

	it('rejects bucket and object traversal', () => {
		expect(() =>
			createStorageObjectArchiveEntry(
				'invitation-assets',
				'../outside.webp',
				Buffer.from('x'.repeat(64)),
			),
		).toThrow(/Invalid Storage object name/);
		expect(() =>
			createStorageObjectArchiveEntry('../bucket', 'hero.webp', Buffer.from('x'.repeat(64))),
		).toThrow(/Invalid Storage bucket/);
	});
});
