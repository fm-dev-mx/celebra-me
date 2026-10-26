import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';

const version = '20261025220000';
const migrationPath = path.join(
	process.cwd(),
	'supabase/migrations/20261025220000_invitation_assets_purge_soft_deleted_cloudinary.sql',
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

describe('soft-deleted Cloudinary asset purge migration', () => {
	it('only deletes soft-deleted cloudinary rows inside one transaction', () => {
		expect(statements).toEqual([
			'begin',
			"delete from public.invitation_assets where provider = 'cloudinary' and deleted_at is not null",
			'commit',
		]);
	});

	it('is ordinary SQL registered as a neutral rollout after the provider contract', () => {
		const { blocked, risk } = evaluateMigrationSqlRisk({
			version,
			registry,
			sqlPath: migrationPath,
		});
		expect(blocked).toBe(false);
		expect(risk.isDestructive).toBe(false);
		expect(registry.migrations[version]?.phase).toBe('neutral');
		expect(version > '20261019180000').toBe(true);
	});
});
