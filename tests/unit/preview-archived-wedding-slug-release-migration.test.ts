/** Executes the ordinary DML with in-memory SQLite; PostgreSQL casts/functions are adapted. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

const version = '20261110100000';
const migrationPath = resolve(
	'supabase/migrations/20261110100000_release_preview_archived_wedding_slug.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const portableSql = sql
	.replace(/::(?:uuid|text)\b/g, '')
	.replace(/alter table[\s\S]+?(?:disable|enable)\s+trigger[^;]+;/gi, '-- trigger toggle');

const previewInvitation = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd';
const canonicalManagedIdentity = '8e4f2a1b-6c3d-4e9f-a0b1-2c3d4e5f6a7b';
const previewPublished = '7a7d3456-5403-4cae-9282-213a35110193';
const previewEvent = 'e1111111-2222-3333-4444-555555555555';

function fixture(): DatabaseSync {
	const db = new DatabaseSync(':memory:');
	db.function('now', () => '2026-11-10T10:00:00Z');
	db.exec(`attach database ':memory:' as public;
    create table public.invitations (
      id text primary key,
      slug text,
      managed_identity_id text,
      archived_at text,
      updated_at text
    );
    create table public.managed_invitation_release_provenance (
      invitation_id text primary key,
      definition_slug text,
      managed_identity_id text,
      applied_at text
    );
    create table public.published_invitation_content (
      id text primary key,
      invitation_project_id text,
      slug text,
      event_type text,
      deleted_at text,
      updated_at text
    );
    create table public.events (
      id text primary key,
      invitation_project_id text,
      slug text,
      event_type text,
      title text,
      status text,
      published_at text,
      updated_at text
    );`);
	return db;
}

function seedPreview(db: DatabaseSync): void {
	db.prepare(
		'insert into public.invitations (id, slug, managed_identity_id, archived_at, updated_at) values (?, ?, ?, ?, ?)',
	).run(
		previewInvitation,
		'daniela-y-martin',
		canonicalManagedIdentity,
		'2026-10-26T17:30:00Z',
		'2026-10-26T17:30:00Z',
	);
	db.prepare(
		'insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, managed_identity_id, applied_at) values (?, ?, ?, ?)',
	).run(previewInvitation, 'daniela-y-martin', canonicalManagedIdentity, '2026-10-26T17:30:00Z');
	db.prepare(
		'insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, deleted_at, updated_at) values (?, ?, ?, ?, ?, ?)',
	).run(
		previewPublished,
		previewInvitation,
		'daniela-y-martin',
		'boda',
		'2026-10-26T17:30:00Z',
		'2026-10-26T17:30:00Z',
	);
	db.prepare(
		'insert into public.events (id, invitation_project_id, slug, event_type, title, status, published_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
	).run(
		previewEvent,
		previewInvitation,
		'daniela-y-martin',
		'boda',
		'Boda de Daniela y Martín',
		'archived',
		'2026-10-26T17:30:00Z',
		'2026-10-26T17:30:00Z',
	);
}

function snapshot(db: DatabaseSync): string {
	return JSON.stringify(
		[
			'invitations',
			'managed_invitation_release_provenance',
			'published_invitation_content',
			'events',
		].map((table) => {
			const col = table === 'managed_invitation_release_provenance' ? 'invitation_id' : 'id';
			return db.prepare(`select * from public.${table} order by ${col}`).all();
		}),
	);
}

describe('Preview archived wedding slug release migration', () => {
	it('frees the slug, managed_identity_id and provenance on Preview while preserving evidence rows', () => {
		const db = fixture();
		try {
			seedPreview(db);
			db.exec(portableSql);

			// Row still exists in invitations (evidence preserved!)
			const inv = db
				.prepare('select * from public.invitations where id = ?')
				.get(previewInvitation) as Record<string, unknown>;
			expect(inv).toBeDefined();
			expect(inv.slug).toBe('daniela-y-martin-archived-b789dbc3');
			expect(inv.managed_identity_id).toBeNull();
			expect(inv.archived_at).toBe('2026-10-26T17:30:00Z');
			expect(inv.updated_at).toBe('2026-11-10T10:00:00Z');

			// Row still exists in managed_invitation_release_provenance (evidence preserved!)
			const prov = db
				.prepare(
					'select * from public.managed_invitation_release_provenance where invitation_id = ?',
				)
				.get(previewInvitation) as Record<string, unknown>;
			expect(prov).toBeDefined();
			expect(prov.definition_slug).toBe('daniela-y-martin-archived-b789dbc3');
			expect(prov.managed_identity_id).toBeNull();

			// Published content route key freed
			const pub = db
				.prepare('select * from public.published_invitation_content where id = ?')
				.get(previewPublished) as Record<string, unknown>;
			expect(pub.slug).toBe('daniela-y-martin-archived-b789dbc3');

			// Event route key freed
			const evt = db
				.prepare('select * from public.events where id = ?')
				.get(previewEvent) as Record<string, unknown>;
			expect(evt.slug).toBe('daniela-y-martin-archived-b789dbc3');

			// Canonical slug is completely unoccupied
			const slugOccupants = db
				.prepare(
					"select count(*) as n from public.invitations where slug = 'daniela-y-martin'",
				)
				.get() as { n: number };
			expect(slugOccupants.n).toBe(0);

			// Canonical managed_identity_id is completely unoccupied
			const identityOccupants = db
				.prepare(
					`select count(*) as n from public.invitations where managed_identity_id = '${canonicalManagedIdentity}'`,
				)
				.get() as { n: number };
			expect(identityOccupants.n).toBe(0);

			// Provenance identity is completely unoccupied
			const provIdentityOccupants = db
				.prepare(
					`select count(*) as n from public.managed_invitation_release_provenance where managed_identity_id = '${canonicalManagedIdentity}'`,
				)
				.get() as { n: number };
			expect(provIdentityOccupants.n).toBe(0);

			// Idempotency: re-running does not change state further
			const after = snapshot(db);
			db.exec(portableSql);
			expect(snapshot(db)).toBe(after);
		} finally {
			db.close();
		}
	});

	it('does not touch Production rows with different IDs even for the same slug', () => {
		const db = fixture();
		try {
			db.exec(`
				insert into public.invitations (id, slug, managed_identity_id, archived_at, updated_at)
				values ('production-wedding-id', 'daniela-y-martin', 'prod-managed-identity', null, 'before');
				insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, managed_identity_id, applied_at)
				values ('production-wedding-id', 'daniela-y-martin', 'prod-managed-identity', 'before');
				insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, deleted_at, updated_at)
				values ('production-pub-id', 'production-wedding-id', 'daniela-y-martin', 'boda', null, 'before');
				insert into public.events (id, invitation_project_id, slug, event_type, title, status, published_at, updated_at)
				values ('production-evt-id', 'production-wedding-id', 'daniela-y-martin', 'boda', 'Real Wedding', 'published', 'before', 'before');
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
