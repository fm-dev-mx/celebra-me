import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';

const version = '20261026120000';
const migrationPath = path.join(
	process.cwd(),
	'supabase/migrations/20261026120000_invitation_assets_soft_delete_orphan_supabase_rows.sql',
);
const statements = readFileSync(migrationPath, 'utf8')
	.replace(/--[^\n]*/g, ' ')
	.toLowerCase()
	.split(';')
	.map((statement) => statement.replace(/\s+/g, ' ').trim())
	.filter(Boolean);
const registry = JSON.parse(
	readFileSync(path.join(process.cwd(), 'supabase/migration-rollout-registry.json'), 'utf8'),
) as MigrationRolloutRegistry;
const update = statements[1] ?? '';
const ids = [...update.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map((match) => match[1]);

describe('orphan supabase asset soft-delete migration', () => {
	it('runs a single update inside one transaction', () => {
		expect(statements).toHaveLength(3);
		expect(statements[0]).toBe('begin');
		expect(statements[2]).toBe('commit');
		expect(
			update.startsWith(
				'update public.invitation_assets a set deleted_at = now(), updated_at = now() where a.id in (',
			),
		).toBe(true);
	});

	it('names exactly 35 distinct rows by id', () => {
		expect(ids).toHaveLength(35);
		expect(new Set(ids).size).toBe(35);
	});

	it('only touches live supabase rows that no publication or draft uses', () => {
		expect(update).toContain("and a.provider = 'supabase' and a.deleted_at is null");
		expect(update).toContain(
			'not exists ( select 1 from public.published_invitation_content p where strpos(p.content::text, a.id::text) > 0 )',
		);
		expect(update).toContain(
			'not exists ( select 1 from public.invitation_content_drafts d where strpos(d.content::text, a.id::text) > 0 )',
		);
		expect(update).not.toMatch(/\bdelete\b/);
	});

	it('is ordinary SQL registered as a neutral rollout', () => {
		const { blocked, risk } = evaluateMigrationSqlRisk({
			version,
			registry,
			sqlPath: migrationPath,
		});
		expect(blocked).toBe(false);
		expect(risk.isDestructive).toBe(false);
		expect(registry.migrations[version]?.phase).toBe('neutral');
	});
});
