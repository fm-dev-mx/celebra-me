/**
 * Read-only export of sanitized Production published content into versioned Local corpus fixtures.
 * Does not mutate remote environments. Strips only non-render operational coupling by selecting
 * invitations + published_invitation_content fields (no guests/auth/RSVP/analytics).
 *
 * Usage: pnpm exec tsx scripts/provision/local-render-corpus/export-legacy-fixtures.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDbUrlForEnv } from '../dbs-status.ts';
import { runPsql, sqlLiteral } from '../../db/db-workflow-lib.ts';
import { listLocalRenderCorpus } from './registry.ts';
import type { LocalRenderCorpusFixture } from './fixture-types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, 'fixtures');

function parseJsonObject(stdout: string): Record<string, unknown> {
	const start = stdout.indexOf('{');
	const end = stdout.lastIndexOf('}');
	if (start < 0 || end < start) {
		throw new Error(`Expected JSON object in psql output: ${stdout.slice(0, 200)}`);
	}
	return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
}

function exportSlug(dbUrl: string, slug: string): LocalRenderCorpusFixture {
	const sql = `
select row_to_json(t) from (
  select
    i.slug,
    i.event_type as "eventType",
    i.title,
    i.theme_id as "themeId",
    i.base_demo_id as "baseDemoId",
    i.snapshot,
    p.content as "publishedContent",
    coalesce(p.content->>'_assetSlug', '') as "assetSlug"
  from public.invitations i
  join public.published_invitation_content p on p.invitation_project_id = i.id
  where i.slug = ${sqlLiteral(slug)}
    and i.archived_at is null
    and p.deleted_at is null
  limit 1
) t;`;
	const res = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (res.status !== 0 || !res.stdout.trim()) {
		throw new Error(`Failed to export ${slug}: ${res.stderr || res.stdout || 'empty'}`);
	}
	const row = parseJsonObject(res.stdout);
	const snapshot = (row.snapshot ?? {}) as Record<string, unknown>;
	const previewSlug =
		typeof snapshot.previewSlug === 'string' && snapshot.previewSlug
			? snapshot.previewSlug
			: String(row.baseDemoId);
	return {
		schemaVersion: 1,
		slug: String(row.slug),
		eventType: String(row.eventType),
		title: String(row.title),
		themeId: String(row.themeId),
		baseDemoId: String(row.baseDemoId),
		snapshot: {
			previewSlug,
			themeId: String(row.themeId),
			baseDemoId: String(row.baseDemoId),
		},
		publishedContent: row.publishedContent as Record<string, unknown>,
		notes: 'Sanitized render fixture: invitations identity + published_invitation_content only. No Auth, guests, RSVP, analytics, or drafts.',
	};
}

function main(): void {
	const { dbUrl, error } = resolveDbUrlForEnv('production');
	if (!dbUrl) throw new Error(error ?? 'Production DB URL unavailable');

	mkdirSync(FIXTURES_DIR, { recursive: true });
	const legacy = listLocalRenderCorpus().filter((e) => e.classification === 'legacy');
	for (const entry of legacy) {
		if (!entry.fixtureFile) throw new Error(`Missing fixtureFile for ${entry.slug}`);
		const fixture = exportSlug(dbUrl, entry.slug);
		if (fixture.eventType !== entry.eventType) {
			throw new Error(
				`Event type mismatch for ${entry.slug}: corpus=${entry.eventType} production=${fixture.eventType}`,
			);
		}
		const outPath = resolve(FIXTURES_DIR, entry.fixtureFile);
		writeFileSync(outPath, `${JSON.stringify(fixture, null, '\t')}\n`, 'utf8');
		console.log(`Wrote ${outPath}`);
	}
	console.log(`Exported ${legacy.length} legacy Local Render Corpus fixtures.`);
}

main();
