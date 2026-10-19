/**
 * preview-demo-republish.ts — Republish one Preview demo row from its versioned JSON.
 *
 * Demo pages read the published row first and fall back to `src/content/event-demos` only when
 * no row exists, so a stale Preview row keeps serving old copy and media. This replaces the
 * published content (and the active draft, when one exists) of exactly one demo with the
 * schema-parsed JSON from the repository. A demo without versioned JSON can instead have one
 * Cloudinary URL swapped for its R2 copy, leaving the rest of its content as stored.
 * Preview only; Production is rejected.
 */

import { existsSync, readFileSync } from 'node:fs';
import { parsePsqlJson, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { redactDbUrl } from '../db/db-target-config.ts';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { resolvePreviewOnlyDbUrl } from './preview-db-target.ts';
import {
	authorizePreviewWriteApply,
	verifyPreviewWriteAuthorization,
} from './preview-write-auth.ts';

export const PREVIEW_DEMO_REPUBLISH_OPERATION = 'demo-republish';

const SLUG_PATTERN = /^demo-[a-z0-9-]+$/;
const CLOUDINARY_HOST = 'res.cloudinary.com';
const R2_MEDIA_ORIGINS = ['https://media.celebra-me.com', 'https://media-staging.celebra-me.com'];
const REPLACE_URL_SOURCE = 'url replacement';

export interface PreviewDemoRepublishResult {
	action: 'unchanged' | 'dry_run_update' | 'updated';
	slug: string;
	eventType: string;
	sourcePath: string;
	publishedVersion: number;
	changedSections: string[];
	draftChanged: boolean;
	/** String values swapped by a URL replacement (publication and draft); 0 otherwise. */
	replacedUrls: number;
	cloudinaryUrlsBefore: number;
	cloudinaryUrlsAfter: number;
	dbUrlRedacted: string;
}

interface PublishedDemoRow {
	id: string;
	invitation_id: string;
	event_type: string;
	version: number;
	kind: string;
	content: Record<string, unknown>;
	draft_content: Record<string, unknown> | null;
}

export function demoSourcePath(eventType: string, slug: string): string {
	return `src/content/event-demos/${eventType}/${slug}.json`;
}

/**
 * Published demo content from its versioned JSON. The schema drops underscore-prefixed
 * metadata such as `_assetSlug`, which the renderer still reads, so those keys are kept.
 */
export function buildDemoPublishedContent(
	source: Record<string, unknown>,
): Record<string, unknown> {
	const parsed = eventContentSchema.parse({ ...source, isDemo: true }) as Record<string, unknown>;
	const metadata = Object.fromEntries(
		Object.entries(source).filter(([key]) => key.startsWith('_')),
	);
	return { ...parsed, ...metadata };
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entry]) => entry !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

/** Top-level sections whose value differs, ignoring key order. */
export function changedTopLevelSections(
	current: Record<string, unknown>,
	next: Record<string, unknown>,
): string[] {
	const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
	return [...keys]
		.filter((key) => stableStringify(current[key]) !== stableStringify(next[key]))
		.sort();
}

export function countCloudinaryUrls(content: unknown): number {
	return JSON.stringify(content ?? null).split(CLOUDINARY_HOST).length - 1;
}

function loadPublishedDemo(dbUrl: string, slug: string): PublishedDemoRow {
	const res = runPsql(
		`select coalesce(json_agg(t), '[]'::json) from (
			select p.id::text, p.invitation_project_id::text as invitation_id, p.event_type,
				p.version, i.kind, p.content,
				(select d.content from public.invitation_content_drafts d
				 where d.invitation_project_id = p.invitation_project_id and d.deleted_at is null
				 order by d.updated_at desc limit 1) as draft_content
			from public.published_invitation_content p
			join public.invitations i on i.id = p.invitation_project_id
			where p.slug = ${sqlLiteral(slug)} and p.is_demo and p.deleted_at is null
		) t;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: true },
	);
	const rows = (parsePsqlJson(res.stdout) ?? []) as PublishedDemoRow[];
	if (rows.length === 0) {
		throw new Error(`PREVIEW_DEMO_NOT_FOUND: Preview has no published demo row for "${slug}".`);
	}
	if (rows.length > 1) {
		throw new Error(
			`PREVIEW_DEMO_IDENTITY_CONFLICT: Preview has ${rows.length} published demo rows for "${slug}".`,
		);
	}
	const row = rows[0]!;
	if (row.kind !== 'demo') {
		throw new Error(
			`PREVIEW_DEMO_KIND_REJECTED: "${slug}" belongs to a "${row.kind}" invitation, not a demo.`,
		);
	}
	return row;
}

function readDemoSource(
	eventType: string,
	slug: string,
): { path: string; source: Record<string, unknown> } {
	const path = demoSourcePath(eventType, slug);
	if (!existsSync(path)) {
		throw new Error(
			`PREVIEW_DEMO_SOURCE_MISSING: "${eventType}/${slug}" has no versioned JSON at ${path}; nothing to republish from.`,
		);
	}
	const source = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
	if (source.eventType !== eventType) {
		throw new Error(
			`PREVIEW_DEMO_EVENT_TYPE_MISMATCH: ${path} declares eventType "${String(source.eventType)}", Preview row is "${eventType}".`,
		);
	}
	return { path, source };
}

/** Replaces string values equal to `from`, at any depth; substrings are left alone. */
export function replaceStringValue(
	value: unknown,
	from: string,
	to: string,
): { value: unknown; count: number } {
	if (value === from) return { value: to, count: 1 };
	if (Array.isArray(value)) {
		let count = 0;
		const items = value.map((item) => {
			const replaced = replaceStringValue(item, from, to);
			count += replaced.count;
			return replaced.value;
		});
		return { value: items, count };
	}
	if (value && typeof value === 'object') {
		let count = 0;
		const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
			const replaced = replaceStringValue(entry, from, to);
			count += replaced.count;
			return [key, replaced.value] as const;
		});
		return { value: Object.fromEntries(entries), count };
	}
	return { value, count: 0 };
}

/** Only a Cloudinary delivery URL may be swapped, and only for a live R2 media object. */
async function assertMediaUrlReplacement(
	replacement: { from: string; to: string },
	fetchImpl: typeof fetch,
): Promise<void> {
	if (!replacement.from.startsWith(`https://${CLOUDINARY_HOST}/`)) {
		throw new Error(
			`PREVIEW_DEMO_URL_REJECTED: only https://${CLOUDINARY_HOST}/ URLs can be replaced.`,
		);
	}
	if (!R2_MEDIA_ORIGINS.some((origin) => replacement.to.startsWith(`${origin}/`))) {
		throw new Error(
			`PREVIEW_DEMO_URL_REJECTED: the replacement must live on ${R2_MEDIA_ORIGINS.join(' or ')}.`,
		);
	}
	const response = await fetchImpl(replacement.to, { method: 'HEAD', redirect: 'error' });
	if (response.status !== 200) {
		throw new Error(
			`PREVIEW_DEMO_URL_UNREACHABLE: ${replacement.to} answered HTTP ${response.status}.`,
		);
	}
}

interface PlannedDemoContent {
	sourcePath: string;
	nextPublished: Record<string, unknown>;
	nextDraft: Record<string, unknown> | null;
	replacedUrls: number;
}

function planDemoContent(
	row: PublishedDemoRow,
	slug: string,
	replaceUrl: { from: string; to: string } | undefined,
): PlannedDemoContent {
	if (!replaceUrl) {
		const { path, source } = readDemoSource(row.event_type, slug);
		const nextPublished = buildDemoPublishedContent(source);
		// The draft, when present, receives the same content as the publication.
		const nextDraft = row.draft_content === null ? null : nextPublished;
		return { sourcePath: path, nextPublished, nextDraft, replacedUrls: 0 };
	}
	const published = replaceStringValue(row.content, replaceUrl.from, replaceUrl.to);
	if (published.count === 0) {
		throw new Error(
			`PREVIEW_DEMO_URL_NOT_FOUND: the published "${slug}" does not contain ${replaceUrl.from}.`,
		);
	}
	const draft =
		row.draft_content === null
			? null
			: replaceStringValue(row.draft_content, replaceUrl.from, replaceUrl.to);
	return {
		sourcePath: REPLACE_URL_SOURCE,
		nextPublished: published.value as Record<string, unknown>,
		nextDraft: (draft?.value as Record<string, unknown> | undefined) ?? null,
		replacedUrls: published.count + (draft?.count ?? 0),
	};
}

export async function republishPreviewDemo(options: {
	slug: string;
	apply?: boolean;
	/** Swap one Cloudinary URL for its R2 copy instead of republishing from the JSON. */
	replaceUrl?: { from: string; to: string };
	isInteractive?: boolean;
	readConfirmationLine?: () => string | Promise<string>;
	env?: NodeJS.ProcessEnv;
	fetchImpl?: typeof fetch;
}): Promise<PreviewDemoRepublishResult> {
	const { slug } = options;
	const apply = options.apply === true;
	if (!SLUG_PATTERN.test(slug)) {
		throw new Error(`PREVIEW_DEMO_SLUG_REJECTED: "${slug}" is not a demo slug (demo-*).`);
	}
	const dbUrl = resolvePreviewOnlyDbUrl(
		{ errorPrefix: 'PREVIEW_DEMO', purpose: 'republish Preview demos' },
		options.env,
	);
	// Report a missing or mismatched scope before reading anything remote.
	if (apply) {
		verifyPreviewWriteAuthorization({
			slug,
			targets: ['preview'],
			apply: true,
			isInteractive: options.isInteractive,
			operation: PREVIEW_DEMO_REPUBLISH_OPERATION,
		});
	}

	const replaceUrl = options.replaceUrl;
	if (replaceUrl) await assertMediaUrlReplacement(replaceUrl, options.fetchImpl ?? fetch);

	const row = loadPublishedDemo(dbUrl, slug);
	const { sourcePath, nextPublished, nextDraft, replacedUrls } = planDemoContent(
		row,
		slug,
		replaceUrl,
	);
	const changedSections = changedTopLevelSections(row.content, nextPublished);
	const draftChanged =
		row.draft_content !== null &&
		nextDraft !== null &&
		changedTopLevelSections(row.draft_content, nextDraft).length > 0;
	const result: PreviewDemoRepublishResult = {
		action: changedSections.length === 0 && !draftChanged ? 'unchanged' : 'dry_run_update',
		slug,
		eventType: row.event_type,
		sourcePath,
		publishedVersion: row.version,
		changedSections,
		draftChanged,
		replacedUrls,
		cloudinaryUrlsBefore:
			countCloudinaryUrls(row.content) + countCloudinaryUrls(row.draft_content),
		cloudinaryUrlsAfter: countCloudinaryUrls(nextPublished) + countCloudinaryUrls(nextDraft),
		dbUrlRedacted: redactDbUrl(dbUrl),
	};
	if (!apply || result.action === 'unchanged') return result;

	await authorizePreviewWriteApply({
		slug,
		operation: PREVIEW_DEMO_REPUBLISH_OPERATION,
		confirmPrompt: `Republish Preview demo ${row.event_type}/${slug} from ${sourcePath}?`,
		readConfirmationLine: options.readConfirmationLine,
		isInteractive: options.isInteractive,
	});

	const content = sqlLiteral(JSON.stringify(nextPublished));
	const draftContent = sqlLiteral(JSON.stringify(nextDraft ?? nextPublished));
	// One statement: the publication moves only from the version that was planned.
	const res = runPsql(
		`with pub as (
			update public.published_invitation_content
			set content = ${content}::jsonb, version = version + 1, updated_at = now(), published_at = now()
			where id = ${sqlLiteral(row.id)}::uuid and version = ${row.version} and deleted_at is null
			  and content is distinct from ${content}::jsonb
			returning version
		), drf as (
			update public.invitation_content_drafts
			set content = ${draftContent}::jsonb, updated_at = now()
			where invitation_project_id = ${sqlLiteral(row.invitation_id)}::uuid and deleted_at is null
			  and ${draftChanged}
			  and content is distinct from ${draftContent}::jsonb
			  and (${changedSections.length === 0} or exists (select 1 from pub))
			returning id
		)
		select json_build_object(
			'version', (select max(version) from pub),
			'published', (select count(*) from pub),
			'drafts', (select count(*) from drf)
		);`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: true },
	);
	const written = parsePsqlJson(res.stdout) as { version: number | null; published: number };
	if (changedSections.length > 0 && written.published !== 1) {
		throw new Error(
			`PREVIEW_DEMO_STALE_PLAN: "${slug}" moved past version ${row.version} while planning; re-run the dry-run.`,
		);
	}
	return { ...result, action: 'updated', publishedVersion: written.version ?? row.version };
}
