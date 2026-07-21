/** Exercises every mutable public baseline field against the real publication RPC. */
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dbUrl = 'postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres';
const content = `'{"title":"Baseline publication"}'::jsonb`;

function query(sql: string): string {
	const result = spawnSync(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--tuples-only',
			'--no-align',
			'--dbname',
			dbUrl,
			'--command',
			sql,
		],
		{ encoding: 'utf8' },
	);
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

interface Scenario {
	name: string;
	mutation: (invitationId: string) => string;
	shouldPublish?: boolean;
	withPublishedContent?: boolean;
}

const scenarios: Scenario[] = [
	{
		name: 'draft content',
		mutation: (_id) =>
			`update public.invitation_content_drafts set content = '{"title":"Changed draft"}'::jsonb where invitation_project_id = '${_id}';`,
	},
	{
		name: 'slug',
		mutation: (id) =>
			`update public.invitations set slug = 'changed-${id.slice(0, 8)}' where id = '${id}';`,
	},
	{
		name: 'title',
		mutation: (id) =>
			`update public.invitations set title = 'Changed title' where id = '${id}';`,
	},
	{
		name: 'event type',
		mutation: (id) => `update public.invitations set event_type = 'boda' where id = '${id}';`,
	},
	{
		name: 'base demo',
		mutation: (id) =>
			`update public.invitations set base_demo_id = 'demo-xv-editorial' where id = '${id}';`,
	},
	{
		name: 'theme',
		mutation: (id) =>
			`update public.invitations set theme_id = 'editorial' where id = '${id}';`,
	},
	{
		name: 'kind',
		mutation: (id) => `update public.invitations set kind = 'client' where id = '${id}';`,
	},
	{
		name: 'snapshot',
		mutation: (id) =>
			`update public.invitations set snapshot = '{"previewSlug":"changed"}'::jsonb where id = '${id}';`,
	},
	{
		name: 'availability',
		mutation: (id) => `update public.invitations set status = 'archived' where id = '${id}';`,
	},
	{
		name: 'published repair content',
		mutation: (id) =>
			`update public.published_invitation_content set content = '{"title":"Repaired without version bump"}'::jsonb where invitation_project_id = '${id}';`,
		withPublishedContent: true,
	},
	{
		name: 'contact-only metadata',
		mutation: (id) =>
			`update public.invitations set client_email = 'contact-only@example.test', client_whatsapp = '5551234567' where id = '${id}';`,
		shouldPublish: true,
	},
];

function metadataHash(invitationId: string): string {
	return query(
		`select md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'baseDemoId', i.base_demo_id, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'snapshot', i.snapshot, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5(coalesce((select p.content from public.published_invitation_content p where p.invitation_project_id = i.id and p.deleted_at is null limit 1), '{}'::jsonb)::text)) from public.invitations i where i.id = '${invitationId}';`,
	);
}

function runScenario(scenario: Scenario): void {
	const invitationId = randomUUID();
	const draftId = randomUUID();
	const key = randomUUID();
	const slug = `baseline-${invitationId.slice(0, 8)}`;
	query(
		`insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, kind) values ('${invitationId}', '${slug}', 'Baseline publication', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'demo'); insert into public.invitation_content_drafts (id, invitation_project_id, content, status) values ('${draftId}', '${invitationId}', ${content}, 'draft'); ${scenario.withPublishedContent ? `insert into public.published_invitation_content (invitation_project_id, slug, event_type, is_demo, content, version) values ('${invitationId}', '${slug}', 'xv', true, '{"title":"Before repair"}'::jsonb, 1);` : ''}`,
	);
	const reviewedMetadataHash = metadataHash(invitationId);
	const reviewedDraftAt = query(
		`select updated_at from public.invitation_content_drafts where id = '${draftId}';`,
	);
	const expectedVersion = scenario.withPublishedContent ? '1' : 'null';
	query(scenario.mutation(invitationId));
	const call = `select public.publish_invitation_atomic('${invitationId}', '${draftId}', '${reviewedDraftAt}', ${expectedVersion}, '${reviewedMetadataHash}', md5(${content}::text), '${key}', '${slug}', 'xv', true, ${content});`;
	let succeeded = true;
	try {
		query(call);
	} catch {
		succeeded = false;
	}
	if (succeeded !== Boolean(scenario.shouldPublish))
		throw new Error(
			`${scenario.name}: expected publish=${Boolean(scenario.shouldPublish)}, got ${succeeded}.`,
		);
	const count = query(
		`select count(*) from public.invitation_publication_idempotency where idempotency_key = '${key}';`,
	);
	if (scenario.shouldPublish) {
		if (count !== '1')
			throw new Error(`${scenario.name}: successful publication has no receipt.`);
	} else if (count !== '0') {
		throw new Error(`${scenario.name}: stale publication left a receipt.`);
	}
}

function assertRollbackAfterReceiptReservation(): void {
	const ownerId = randomUUID();
	const invitationId = randomUUID();
	const draftId = randomUUID();
	const key = randomUUID();
	const slug = `rollback-conflict-${invitationId.slice(0, 8)}`;
	query(
		`insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, kind) values ('${ownerId}', '${slug}', 'Existing slug owner', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'demo'); insert into public.published_invitation_content (invitation_project_id, slug, event_type, is_demo, content, version) values ('${ownerId}', '${slug}', 'xv', true, '{"title":"Existing"}'::jsonb, 1); insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, kind) values ('${invitationId}', '${slug}-draft', 'Rollback target', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'demo'); insert into public.invitation_content_drafts (id, invitation_project_id, content, status) values ('${draftId}', '${invitationId}', ${content}, 'draft');`,
	);
	const hash = metadataHash(invitationId);
	const draftAt = query(
		`select updated_at from public.invitation_content_drafts where id = '${draftId}';`,
	);
	let failed = false;
	try {
		query(
			`select public.publish_invitation_atomic('${invitationId}', '${draftId}', '${draftAt}', null, '${hash}', md5(${content}::text), '${key}', '${slug}', 'xv', true, ${content});`,
		);
	} catch {
		failed = true;
	}
	if (!failed) throw new Error('Slug-conflict rollback scenario unexpectedly published.');
	const state = query(
		`select (select count(*) from public.invitation_publication_idempotency where idempotency_key='${key}') || ':' || (select status from public.invitation_content_drafts where id='${draftId}');`,
	);
	if (state !== '0:draft') throw new Error(`Post-lock failure left partial state: ${state}`);
}

try {
	for (const scenario of scenarios) runScenario(scenario);
	assertRollbackAfterReceiptReservation();
	console.info(`Public stale-baseline test passed: ${scenarios.length} scenarios plus rollback.`);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
