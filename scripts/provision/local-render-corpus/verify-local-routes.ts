/**
 * Verify every Local Render Corpus invitation has published content in persistent-local.
 * Usage: pnpm exec tsx scripts/provision/local-render-corpus/verify-local-routes.ts
 */
import { resolveLocalEnv } from '../local-provision-env.ts';
import { runPsql, sqlLiteral } from '../../db/db-workflow-lib.ts';
import {
	assertLocalRenderCorpusIntegrity,
	corpusPublicRoute,
	listLocalRenderCorpus,
} from './registry.ts';

assertLocalRenderCorpusIntegrity();
const env = resolveLocalEnv();

type Row = {
	slug: string;
	route: string;
	localState: 'READY' | 'NOT_PRESENT';
	published: boolean;
	assets: number;
	version: number | null;
};

const rows: Row[] = [];
for (const entry of listLocalRenderCorpus()) {
	const sql = `
select
  exists(select 1 from public.invitations i where i.slug = ${sqlLiteral(entry.slug)} and i.archived_at is null) as has_inv,
  exists(select 1 from public.published_invitation_content p where p.slug = ${sqlLiteral(entry.slug)} and p.event_type = ${sqlLiteral(entry.eventType)} and p.deleted_at is null and p.is_demo = false) as has_pub,
  coalesce((select count(*)::int from public.invitation_assets a join public.invitations i on i.id = a.invitation_id where i.slug = ${sqlLiteral(entry.slug)} and i.archived_at is null and a.deleted_at is null), 0) as assets,
  (select p.version from public.published_invitation_content p where p.slug = ${sqlLiteral(entry.slug)} and p.event_type = ${sqlLiteral(entry.eventType)} and p.deleted_at is null limit 1) as version;`;
	const res = runPsql(sql, env.dbUrl, { tuplesOnly: true, throwOnError: false });
	const [hasInv, hasPub, assets, version] = res.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());
	const ready = hasInv === 't' && hasPub === 't';
	rows.push({
		slug: entry.slug,
		route: corpusPublicRoute(entry),
		localState: ready ? 'READY' : 'NOT_PRESENT',
		published: hasPub === 't',
		assets: Number(assets || 0),
		version: version ? Number(version) : null,
	});
}

console.log('| Invitation | Local state | Public route | Published | Assets | Version |');
console.log('| ---------- | ----------- | ------------ | --------- | ------ | ------- |');
let failed = 0;
for (const row of rows) {
	console.log(
		`| \`${row.slug}\` | ${row.localState} | \`${row.route}\` | ${row.published ? 'PASS' : 'FAIL'} | ${row.assets} | ${row.version ?? '-'} |`,
	);
	if (row.localState !== 'READY') failed += 1;
}

if (failed > 0) {
	console.error(`\nLOCAL_RENDER_CORPUS_VERIFY_FAILED: ${failed} invitation(s) not ready.`);
	process.exit(1);
}
console.log(`\nLOCAL_RENDER_CORPUS_VERIFY_OK: ${rows.length} invitations ready in Local.`);
