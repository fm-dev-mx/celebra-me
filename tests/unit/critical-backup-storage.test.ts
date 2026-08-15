import {
	downloadStorageInventory,
	STORAGE_INVENTORY_SQL,
} from '../../scripts/db/critical-backup-storage';
import {
	BACKUP_PHASE_LABELS,
	formatBackupPhase,
} from '../../scripts/db/critical-backup-progress';

describe('critical backup storage inventory', () => {
	it('does not scan invitation JSON with LIKE', () => {
		expect(STORAGE_INVENTORY_SQL).not.toMatch(/content\s*::\s*text\s+like/i);
		expect(STORAGE_INVENTORY_SQL).toContain('invitation_assets');
		expect(STORAGE_INVENTORY_SQL).toContain("o.bucket_id = 'invitation-assets'");
		expect(STORAGE_INVENTORY_SQL).not.toContain('published_invitation_content');
		expect(STORAGE_INVENTORY_SQL).not.toContain('invitation_content_drafts');
	});

	it('downloads objects with bounded parallelism and fails closed on status', async () => {
		const fetchImpl = jest.fn(async (url: string | URL) => {
			if (String(url).includes('broken')) {
				return {
					ok: false,
					status: 404,
					text: async () => '{"message":"Object not found"}',
				};
			}
			const body = Buffer.from('critical invitation object bytes'.repeat(8));
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => body,
			};
		});
		await expect(
			downloadStorageInventory({
				inventory: [
					{
						bucketId: 'invitation-assets',
						name: 'ok.webp',
						contentType: 'image/webp',
						declaredBytes: null,
						declaredSha256: null,
					},
					{
						bucketId: 'invitation-assets',
						name: 'broken.webp',
						contentType: 'image/webp',
						declaredBytes: null,
						declaredSha256: null,
					},
				],
				prodSupabaseUrl: 'https://example.supabase.co',
				prodServiceRole: 'service-role',
				concurrency: 2,
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).rejects.toThrow(/download failed \(404, not_found/);
		expect(fetchImpl).toHaveBeenCalled();
	});

	it('accepts matching bytes and reports progress', async () => {
		const content = Buffer.from('critical invitation object bytes'.repeat(8));
		const progress: string[] = [];
		const entries = await downloadStorageInventory({
			inventory: [
				{
					bucketId: 'invitation-assets',
					name: 'hero.webp',
					contentType: 'image/webp',
					declaredBytes: content.byteLength,
					declaredSha256: null,
				},
			],
			prodSupabaseUrl: 'https://example.supabase.co',
			prodServiceRole: 'service-role',
			fetchImpl: (async () => ({
				ok: true,
				status: 200,
				arrayBuffer: async () => content,
			})) as unknown as typeof fetch,
			onProgress: (index, total) => progress.push(`${index}/${total}`),
		});
		expect(entries).toHaveLength(1);
		expect(entries[0]?.bytes).toBe(content.byteLength);
		expect(progress).toEqual(['1/1']);
	});
});

describe('critical backup progress copy', () => {
	it('labels capture phases for the operator', () => {
		expect(formatBackupPhase(BACKUP_PHASE_LABELS.dumpPublic)).toBe('Respaldo: pg_dump public');
		expect(formatBackupPhase(BACKUP_PHASE_LABELS.storageObjects, '3/12')).toBe(
			'Respaldo: objetos Storage · 3/12',
		);
	});
});

