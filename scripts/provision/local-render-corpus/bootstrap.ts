/**
 * Local-only bootstrap for the Local Render Corpus.
 * Canonical entries → applyLocalInvitation; legacy → sanitized invitations + published content upsert.
 */
import { createHash } from 'node:crypto';
import { resolveLocalEnv } from '../local-provision-env.ts';
import { runPsql, sqlLiteral } from '../../db/db-workflow-lib.ts';
import { classifyDbTarget } from '../../db/db-guard.ts';
import { applyLocalInvitation } from '../apply-local-invitation.ts';
import { eventContentSchema } from '../../../src/lib/schemas/content/base-event.schema.ts';
import {
	assertLocalRenderCorpusIntegrity,
	listLocalRenderCorpus,
	type LocalRenderCorpusEntry,
} from './registry.ts';
import { loadLegacyCorpusFixture } from './load-fixture.ts';

export type CorpusBootstrapMode = 'dry-run' | 'apply';

export interface CorpusBootstrapEntryResult {
	slug: string;
	classification: LocalRenderCorpusEntry['classification'];
	action: 'planned' | 'applied' | 'unchanged';
	detail: string;
}

export interface CorpusBootstrapResult {
	mode: CorpusBootstrapMode;
	target: 'persistent-local';
	entries: CorpusBootstrapEntryResult[];
}

function deriveDeterministicUuid(namespace: string, seed: string): string {
	const hash = createHash('sha256').update(`celebra-me:${namespace}:${seed}`).digest('hex');
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function assertLocalOnly(dbUrl: string): void {
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== 'persistent-local') {
		throw new Error(
			`LOCAL_RENDER_CORPUS_TARGET_REJECTED: bootstrap may only target persistent-local (got ${classification.target}).`,
		);
	}
}

function readActiveInvitationId(dbUrl: string, slug: string): string | null {
	const res = runPsql(
		`select id::text from public.invitations where slug = ${sqlLiteral(slug)} and archived_at is null limit 1;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const id = res.stdout.trim();
	return id || null;
}

function publishedMatches(
	dbUrl: string,
	slug: string,
	eventType: string,
	content: Record<string, unknown>,
): boolean {
	const res = runPsql(
		`select content = ${sqlLiteral(JSON.stringify(content))}::jsonb
		 from public.published_invitation_content
		 where slug = ${sqlLiteral(slug)}
		   and event_type = ${sqlLiteral(eventType)}
		   and deleted_at is null
		   and is_demo = false
		 limit 1;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	return res.stdout.trim() === 't';
}

function upsertLegacyFixture(
	dbUrl: string,
	entry: LocalRenderCorpusEntry,
	apply: boolean,
): CorpusBootstrapEntryResult {
	const fixture = loadLegacyCorpusFixture(entry);
	const parsed = eventContentSchema.safeParse(fixture.publishedContent);
	if (!parsed.success) {
		throw new Error(
			`LOCAL_RENDER_CORPUS_FIXTURE_INVALID: ${entry.slug} publishedContent failed schema: ${parsed.error.message}`,
		);
	}

	const existingId = readActiveInvitationId(dbUrl, entry.slug);
	const invitationId = existingId ?? deriveDeterministicUuid('local-render-corpus', entry.slug);

	if (
		existingId &&
		publishedMatches(dbUrl, entry.slug, entry.eventType, fixture.publishedContent)
	) {
		return {
			slug: entry.slug,
			classification: 'legacy',
			action: 'unchanged',
			detail: `Legacy fixture already present (${invitationId})`,
		};
	}

	if (!apply) {
		return {
			slug: entry.slug,
			classification: 'legacy',
			action: 'planned',
			detail: existingId
				? `Would upsert published content for existing invitation ${existingId}`
				: `Would create invitation ${invitationId} + published content`,
		};
	}

	const snapshotJson = sqlLiteral(JSON.stringify(fixture.snapshot));
	const contentJson = sqlLiteral(JSON.stringify(fixture.publishedContent));

	if (!existingId) {
		const insert = runPsql(
			`insert into public.invitations (
				id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot,
				client_name, client_email, client_whatsapp, photos_received
			) values (
				${sqlLiteral(invitationId)}::uuid,
				${sqlLiteral(fixture.slug)},
				${sqlLiteral(fixture.title)},
				${sqlLiteral(fixture.eventType)},
				'published',
				${sqlLiteral(fixture.baseDemoId)},
				${sqlLiteral(fixture.themeId)},
				'client',
				${snapshotJson}::jsonb,
				'',
				'',
				'',
				true
			)
			on conflict (id) do nothing;`,
			dbUrl,
			{ throwOnError: false },
		);
		if (insert.status !== 0) {
			throw new Error(
				`LOCAL_RENDER_CORPUS_UPSERT_FAILED: invitations insert for ${entry.slug}: ${insert.stderr || insert.stdout}`,
			);
		}
	} else {
		const update = runPsql(
			`update public.invitations set
				title = ${sqlLiteral(fixture.title)},
				status = 'published',
				base_demo_id = ${sqlLiteral(fixture.baseDemoId)},
				theme_id = ${sqlLiteral(fixture.themeId)},
				snapshot = ${snapshotJson}::jsonb,
				updated_at = now()
			 where id = ${sqlLiteral(invitationId)}::uuid
			   and archived_at is null;`,
			dbUrl,
			{ throwOnError: false },
		);
		if (update.status !== 0) {
			throw new Error(
				`LOCAL_RENDER_CORPUS_UPSERT_FAILED: invitations update for ${entry.slug}: ${update.stderr || update.stdout}`,
			);
		}
	}

	const publish = runPsql(
		`insert into public.published_invitation_content (
			invitation_project_id, slug, event_type, is_demo, content, version, published_at
		) values (
			${sqlLiteral(invitationId)}::uuid,
			${sqlLiteral(fixture.slug)},
			${sqlLiteral(fixture.eventType)},
			false,
			${contentJson}::jsonb,
			1,
			now()
		)
		on conflict (event_type, slug) do update set
			invitation_project_id = excluded.invitation_project_id,
			is_demo = false,
			content = excluded.content,
			version = public.published_invitation_content.version + 1,
			published_at = now(),
			deleted_at = null;`,
		dbUrl,
		{ throwOnError: false },
	);
	if (publish.status !== 0) {
		throw new Error(
			`LOCAL_RENDER_CORPUS_UPSERT_FAILED: published content for ${entry.slug}: ${publish.stderr || publish.stdout}`,
		);
	}

	return {
		slug: entry.slug,
		classification: 'legacy',
		action: 'applied',
		detail: `Upserted sanitized Local render fixture (${invitationId})`,
	};
}

async function bootstrapCanonical(
	entry: LocalRenderCorpusEntry,
	apply: boolean,
): Promise<CorpusBootstrapEntryResult> {
	const result = await applyLocalInvitation({
		slug: entry.slug,
		apply,
		// First-time Local population must upload missing managed assets (default content-only preserves).
		updateScope: 'content-and-assets',
		assetPolicy: 'missing',
	});
	const detail = apply
		? `canonical Local apply invitationId=${result.invitationId} zeroDrift=${result.isZeroDrift} ops=${result.completedOperations}`
		: `canonical Local dry-run invitationId=${result.invitationId} plannedOps=${result.plannedOperations}`;
	return {
		slug: entry.slug,
		classification: 'canonical',
		action: apply
			? result.isZeroDrift && result.completedOperations === 0
				? 'unchanged'
				: 'applied'
			: 'planned',
		detail,
	};
}

export async function bootstrapLocalRenderCorpus(options: {
	mode: CorpusBootstrapMode;
	slugs?: readonly string[];
}): Promise<CorpusBootstrapResult> {
	assertLocalRenderCorpusIntegrity();
	const env = resolveLocalEnv();
	assertLocalOnly(env.dbUrl);

	const wanted = options.slugs
		? listLocalRenderCorpus().filter((e) => options.slugs!.includes(e.slug))
		: [...listLocalRenderCorpus()];

	if (options.slugs) {
		for (const slug of options.slugs) {
			if (!wanted.some((e) => e.slug === slug)) {
				throw new Error(`Unknown Local Render Corpus slug: ${slug}`);
			}
		}
	}

	const apply = options.mode === 'apply';
	const entries: CorpusBootstrapEntryResult[] = [];

	for (const entry of wanted) {
		if (entry.classification === 'canonical') {
			entries.push(await bootstrapCanonical(entry, apply));
		} else {
			entries.push(upsertLegacyFixture(env.dbUrl, entry, apply));
		}
	}

	return { mode: options.mode, target: 'persistent-local', entries };
}
