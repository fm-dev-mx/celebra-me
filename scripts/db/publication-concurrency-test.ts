/** Proves two concurrent same-key RPC requests create one publication receipt. */
import { randomUUID } from 'node:crypto';
import { DISPOSABLE_DB_URL } from './db-target-config.ts';
import { runPsql as psql, runPsqlAsync } from './db-workflow-lib.ts';

const PSQL_OPTIONS = { asCommand: true, throwOnError: false } as const;

function runPsql(sql: string): string {
	const result = psql(sql, DISPOSABLE_DB_URL, PSQL_OPTIONS);
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

async function runConcurrentPsql(sql: string): Promise<string> {
	const result = await runPsqlAsync(sql, DISPOSABLE_DB_URL, PSQL_OPTIONS);
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout || `psql exited ${String(result.status)}`);
	}
	return result.stdout.trim();
}

async function main(): Promise<void> {
	const invitationId = randomUUID();
	const draftId = randomUUID();
	const key = randomUUID();
	const slug = `concurrent-${invitationId.slice(0, 8)}`;
	const content = `'{"title":"Concurrent publication"}'::jsonb`;
	const metadataHash = `md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text))`;

	runPsql(`
		insert into public.invitations (id, slug, title, event_type, status, theme_id, kind)
		values ('${invitationId}', '${slug}', 'Concurrent publication', 'xv', 'in_production', 'jewelry-box', 'demo');
		insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
		values ('${draftId}', '${invitationId}', ${content}, 'draft');
		create or replace function public.test_pause_idempotency_insert() returns trigger language plpgsql as $$ begin perform pg_sleep(0.75); return new; end; $$;
		create trigger test_pause_idempotency_insert before insert on public.invitation_publication_idempotency for each row execute function public.test_pause_idempotency_insert();
	`);

	const rpc = `select public.publish_invitation_atomic(i.id, d.id, d.updated_at, null, ${metadataHash}, md5(${content}::text), '${key}', '${slug}', 'xv', true, ${content}) from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.id = '${invitationId}';`;
	try {
		const [first, second] = await Promise.all([runConcurrentPsql(rpc), runConcurrentPsql(rpc)]);
		if (!first.includes('"version": 1') || !second.includes('"version": 1')) {
			throw new Error(
				`Concurrent RPC did not return the first version. first=${first} second=${second}`,
			);
		}
		const state = runPsql(
			`select count(*) || ':' || coalesce(max(version), 0) || ':' || (select count(*) from public.invitation_publication_idempotency where idempotency_key = '${key}') from public.published_invitation_content where invitation_project_id = '${invitationId}';`,
		);
		if (state !== '1:1:1')
			throw new Error(`Concurrent duplicate created unexpected state: ${state}`);
		console.info(
			'Concurrent publication test passed: one published row, version one, one receipt.',
		);
	} finally {
		runPsql(
			'drop trigger if exists test_pause_idempotency_insert on public.invitation_publication_idempotency; drop function if exists public.test_pause_idempotency_insert();',
		);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
