/** Executes the ordinary DML with in-memory SQLite; PostgreSQL casts/functions are adapted. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

const version = '20261026173000';
const migrationPath = resolve(
	'supabase/migrations/20261026173000_retire_preview_legacy_wedding.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const portableSql = sql.replace(/::(?:uuid|text)\b/g, '').replace(/strpos\(/g, 'instr(');
const oldInvitation = '4b616edc-142f-4427-85df-dc75e94aa381';
const currentInvitation = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd';
const currentPublished = '7a7d3456-5403-4cae-9282-213a35110193';
const assetIds = [
	'05438c36-fdba-4f2b-839e-7ad2834216a8',
	'0fd31856-413f-4926-a440-839c52b49397',
	'9d491c21-a841-4455-bbc7-3a203cab778e',
	'cb90fa52-f827-4721-bf67-2a7853fa9221',
	'e79bc7db-e69f-49b6-a329-61cd0a5a6a0a',
];

function fixture(): DatabaseSync {
	const db = new DatabaseSync(':memory:');
	db.function('now', () => 'migration-time');
	db.exec(`attach database ':memory:' as public;
    create table public.invitations (id text, slug text, archived_at text, updated_at text);
    create table public.published_invitation_content
      (id text, invitation_project_id text, content text, deleted_at text, updated_at text);
    create table public.invitation_assets
      (id text, invitation_id text, provider text, deleted_at text, updated_at text);
    create table public.invitation_content_drafts (content text, deleted_at text);`);
	return db;
}

function seedPreview(db: DatabaseSync): void {
	const invitation = db.prepare('insert into public.invitations values (?, ?, ?, ?)');
	invitation.run(oldInvitation, 'boda-daniela-y-martin', 'old-time', 'old-time');
	invitation.run(currentInvitation, 'daniela-y-martin', null, 'old-time');
	db.prepare('insert into public.published_invitation_content values (?, ?, ?, ?, ?)').run(
		currentPublished,
		currentInvitation,
		'{}',
		null,
		'old-time',
	);
	const asset = db.prepare('insert into public.invitation_assets values (?, ?, ?, ?, ?)');
	for (const id of assetIds) asset.run(id, oldInvitation, 'supabase', null, 'old-time');
}

function snapshot(db: DatabaseSync): string {
	return JSON.stringify(
		['invitations', 'published_invitation_content', 'invitation_assets'].map((table) =>
			db.prepare(`select * from public.${table} order by id`).all(),
		),
	);
}

describe('Preview legacy wedding retirement', () => {
	it('retires only Preview identities and is idempotent', () => {
		const db = fixture();
		try {
			seedPreview(db);
			db.exec(portableSql);
			expect(
				db
					.prepare(
						'select count(*) as n from public.invitation_assets where deleted_at is null',
					)
					.get()?.n,
			).toBe(0);
			expect(
				db
					.prepare('select archived_at from public.invitations where id = ?')
					.get(currentInvitation)?.archived_at,
			).toBe('migration-time');
			expect(
				db
					.prepare('select archived_at from public.invitations where id = ?')
					.get(oldInvitation)?.archived_at,
			).toBe('old-time');
			expect(
				db.prepare('select deleted_at from public.published_invitation_content').get()
					?.deleted_at,
			).toBe('migration-time');
			const after = snapshot(db);
			db.exec(portableSql);
			expect(snapshot(db)).toBe(after);
		} finally {
			db.close();
		}
	});

	it('does not modify Production-shaped rows with different IDs, even for the same slug', () => {
		const db = fixture();
		try {
			db.exec(`insert into public.invitations values ('production-invitation', 'daniela-y-martin', null, 'before');
        insert into public.published_invitation_content values ('production-publication', 'production-invitation', '{}', null, 'before');
        insert into public.invitation_assets values ('production-asset', 'production-invitation', 'r2', null, 'before');`);
			const before = snapshot(db);
			db.exec(portableSql);
			expect(snapshot(db)).toBe(before);
		} finally {
			db.close();
		}
	});

	it('preserves live draft/publication references, other providers and changed ownership', () => {
		const db = fixture();
		try {
			seedPreview(db);
			db.prepare('insert into public.invitation_content_drafts values (?, null)').run(
				JSON.stringify({ assetId: assetIds[0] }),
			);
			db.prepare(
				'insert into public.published_invitation_content values (?, ?, ?, null, ?)',
			).run(
				'other-publication',
				'other-invitation',
				JSON.stringify({ assetId: assetIds[1] }),
				'before',
			);
			db.prepare("update public.invitation_assets set provider = 'r2' where id = ?").run(
				assetIds[2]!,
			);
			db.prepare(
				"update public.invitation_assets set invitation_id = 'other-invitation' where id = ?",
			).run(assetIds[3]!);
			db.exec(portableSql);
			const live = db
				.prepare(
					'select id from public.invitation_assets where deleted_at is null order by id',
				)
				.all();
			expect(live.map((row) => row.id)).toEqual(assetIds.slice(0, 4));
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
		expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/\bdelete\s+from\b|\bwhere\s+slug\s*=/i);
	});
});
