/** Executes the ordinary DML with in-memory SQLite; PostgreSQL casts/functions are adapted. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

const version = '20261110120000';
const migrationPath = resolve(
	'supabase/migrations/20261110120000_release_preview_archived_wedding_assets.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const portableSql = sql.replace(/::(?:uuid|text)\b/g, '');

const previewInvitation = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd';
const stagingBucket = 'celebra-me-invitation-media-staging';

function fixture(): DatabaseSync {
	const db = new DatabaseSync(':memory:');
	db.function('now', () => '2026-11-10T12:00:00Z');
	db.exec(`attach database ':memory:' as public;
    create table public.invitation_assets (
      id text primary key,
      invitation_id text,
      bucket text,
      storage_path text,
      updated_at text,
      deleted_at text
    );
    create unique index public.idx_invitation_assets_storage_path
      on invitation_assets(bucket, storage_path);`);
	return db;
}

function seedPreview(db: DatabaseSync): void {
	const insert = db.prepare(
		'insert into public.invitation_assets (id, invitation_id, bucket, storage_path, updated_at, deleted_at) values (?, ?, ?, ?, ?, ?)',
	);
	insert.run(
		'asset-1',
		previewInvitation,
		stagingBucket,
		'invitations/boda/daniela-y-martin/gallery-01-82a4ba12.webp',
		'2026-10-26T17:30:00Z',
		'2026-10-26T17:30:00Z',
	);
	insert.run(
		'asset-2',
		previewInvitation,
		stagingBucket,
		'invitations/boda/daniela-y-martin/hero-desktop-31ce0456.webp',
		'2026-10-26T17:30:00Z',
		null,
	);
	insert.run(
		'asset-unrelated',
		previewInvitation,
		stagingBucket,
		'invitations/boda/unrelated-path/photo.webp',
		'2026-10-26T17:30:00Z',
		null,
	);
}

function snapshot(db: DatabaseSync): string {
	return JSON.stringify(db.prepare('select * from public.invitation_assets order by id').all());
}

describe('Preview archived wedding assets release migration', () => {
	it('relocates storage_path of archived Preview wedding assets and frees the unique constraint', () => {
		const db = fixture();
		try {
			seedPreview(db);
			db.exec(portableSql);

			// Asset 1 was relocated
			const a1 = db
				.prepare('select * from public.invitation_assets where id = ?')
				.get('asset-1') as Record<string, unknown>;
			expect(a1).toBeDefined();
			expect(a1.storage_path).toBe(
				'invitations/boda/daniela-y-martin-archived-b789dbc3/gallery-01-82a4ba12.webp',
			);
			expect(a1.updated_at).toBe('2026-11-10T12:00:00Z');
			// Soft-delete status preserved
			expect(a1.deleted_at).toBe('2026-10-26T17:30:00Z');

			// Asset 2 was relocated
			const a2 = db
				.prepare('select * from public.invitation_assets where id = ?')
				.get('asset-2') as Record<string, unknown>;
			expect(a2).toBeDefined();
			expect(a2.storage_path).toBe(
				'invitations/boda/daniela-y-martin-archived-b789dbc3/hero-desktop-31ce0456.webp',
			);
			expect(a2.updated_at).toBe('2026-11-10T12:00:00Z');

			// Unrelated path on the same invitation is unchanged
			const a3 = db
				.prepare('select * from public.invitation_assets where id = ?')
				.get('asset-unrelated') as Record<string, unknown>;
			expect(a3).toBeDefined();
			expect(a3.storage_path).toBe('invitations/boda/unrelated-path/photo.webp');
			expect(a3.updated_at).toBe('2026-10-26T17:30:00Z');

			// Canonical storage path can now be inserted without duplicate key error
			const newCanonicalId = '8e4f2a1b-6c3d-4e9f-a0b1-2c3d4e5f6a7b';
			expect(() => {
				db.prepare(
					'insert into public.invitation_assets (id, invitation_id, bucket, storage_path, updated_at, deleted_at) values (?, ?, ?, ?, ?, ?)',
				).run(
					'new-asset-1',
					newCanonicalId,
					stagingBucket,
					'invitations/boda/daniela-y-martin/gallery-01-82a4ba12.webp',
					'2026-11-10T12:05:00Z',
					null,
				);
			}).not.toThrow();

			// Idempotency: re-running does not change state further
			const after = snapshot(db);
			db.exec(portableSql);
			expect(snapshot(db)).toBe(after);
		} finally {
			db.close();
		}
	});

	it('does not touch Production rows or assets from other invitations', () => {
		const db = fixture();
		try {
			db.exec(`
				insert into public.invitation_assets (id, invitation_id, bucket, storage_path, updated_at, deleted_at)
				values ('prod-asset-1', 'production-wedding-id', '${stagingBucket}', 'invitations/boda/daniela-y-martin/gallery-01-82a4ba12.webp', 'before', null);
			`);
			const before = snapshot(db);
			db.exec(portableSql);
			expect(snapshot(db)).toBe(before);
		} finally {
			db.close();
		}
	});

	it('is registered as a neutral data migration', () => {
		const registry = JSON.parse(
			readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
		) as MigrationRolloutRegistry;
		const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: migrationPath });
		expect(result.blocked).toBe(false);
		expect(result.risk.isDestructive).toBe(false);
		expect(registry.migrations[version]?.phase).toBe('neutral');
		expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/\bdelete\s+from\b/i);
	});
});
