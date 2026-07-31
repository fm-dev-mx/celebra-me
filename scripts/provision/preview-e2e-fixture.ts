/**
 * preview-e2e-fixture.ts — Deterministic Preview-only E2E publication fixture bootstrap
 *
 * Creates or verifies slug `e2e-preview-publication` owned by preview@preview.com.
 * Uses Preview DB write primitives (psql) and existing Preview write-auth guards.
 * Does NOT restore Dashboard/API creation. Production is rejected.
 */

import { createHash, randomUUID } from 'node:crypto';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import {
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
	PREVIEW_FIXTURE_TITLE,
} from '../playwright/preview-environment.ts';
import { classifyDbTarget, redactDbUrl } from '../db/db-guard.ts';
import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { resolvePreviewAdminUser, PREVIEW_ADMIN_EMAIL } from '../db/preview-sync-guards.ts';
import { verifyPreviewWriteAuthorization } from './preview-write-auth.ts';

export const PREVIEW_E2E_FIXTURE_OPERATION = 'e2e-fixture';

function deriveDeterministicUuid(namespace: string, seed: string): string {
	const hash = createHash('sha256').update(`celebra-me:${namespace}:${seed}`).digest('hex');
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export interface PreviewE2eFixtureResult {
	action: 'created' | 'already_present' | 'dry_run_create' | 'dry_run_present';
	invitationId: string;
	slug: string;
	ownerUserId: string;
	dbUrlRedacted: string;
}

export function resolvePreviewFixtureDbUrl(env: NodeJS.ProcessEnv = process.env): string {
	const url = (
		env.PREVIEW_DB_URL?.trim() ||
		getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
	).trim();
	if (!url) {
		throw new Error(
			'PREVIEW_E2E_FIXTURE_CREDENTIALS: PREVIEW_DB_URL is required to provision the Preview E2E fixture.',
		);
	}

	const classification = classifyDbTarget(url);
	if (classification.target === 'production') {
		throw new Error(
			'PREVIEW_E2E_FIXTURE_PRODUCTION_REJECTED: Preview E2E fixture provisioning must not target Production.',
		);
	}
	if (classification.target !== 'preview') {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_TARGET_REJECTED: Expected Preview database target, got "${classification.target}" (${redactDbUrl(url)}).`,
		);
	}
	return url;
}

function loadActiveFixture(dbUrl: string): {
	id: string;
	slug: string;
	title: string;
	event_type: string;
	base_demo_id: string;
	created_by: string;
	client_name: string;
	client_email: string;
	client_whatsapp: string;
} | null {
	const res = runPsql(
		`select row_to_json(t) from (
			select id::text, slug, title, event_type, base_demo_id, created_by::text,
				coalesce(client_name, '') as client_name,
				coalesce(client_email, '') as client_email,
				coalesce(client_whatsapp, '') as client_whatsapp
			from public.invitations
			where slug = ${sqlLiteral(PREVIEW_FIXTURE_SLUG)} and archived_at is null
			limit 2
		) t;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const lines = res.stdout.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length > 1) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_IDENTITY_CONFLICT: Multiple active invitations for slug ${PREVIEW_FIXTURE_SLUG}.`,
		);
	}
	if (lines.length === 0) return null;
	return JSON.parse(lines[0]!) as {
		id: string;
		slug: string;
		title: string;
		event_type: string;
		base_demo_id: string;
		created_by: string;
		client_name: string;
		client_email: string;
		client_whatsapp: string;
	};
}

function assertCanonicalExisting(
	row: NonNullable<ReturnType<typeof loadActiveFixture>>,
	ownerUserId: string,
): void {
	const ok =
		row.slug === PREVIEW_FIXTURE_SLUG &&
		row.title === PREVIEW_FIXTURE_TITLE &&
		row.event_type === PREVIEW_FIXTURE_EVENT_TYPE &&
		row.base_demo_id === PREVIEW_FIXTURE_DEMO_ID &&
		row.created_by === ownerUserId &&
		row.client_name === '' &&
		row.client_email === '' &&
		row.client_whatsapp === '';
	if (!ok) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_MISMATCH: Existing ${PREVIEW_FIXTURE_SLUG} does not match the canonical Preview fixture identity owned by ${PREVIEW_ADMIN_EMAIL}.`,
		);
	}
}

function ensureDraft(dbUrl: string, invitationId: string, apply: boolean): void {
	const existing = runPsql(
		`select id::text from public.invitation_content_drafts
		 where invitation_project_id = ${sqlLiteral(invitationId)}::uuid and deleted_at is null
		 limit 1;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	).stdout.trim();
	if (existing) return;
	if (!apply) return;
	const draftId = randomUUID();
	const content = JSON.stringify({ title: PREVIEW_FIXTURE_TITLE });
	const insert = runPsql(
		`insert into public.invitation_content_drafts (id, invitation_project_id, submission_id, content, status)
		 values (${sqlLiteral(draftId)}::uuid, ${sqlLiteral(invitationId)}::uuid, null, ${sqlLiteral(content)}::jsonb, 'draft');`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (insert.status !== 0) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_DRAFT_FAILED: Could not create draft for ${PREVIEW_FIXTURE_SLUG}.`,
		);
	}
}

function createFixtureRow(input: {
	dbUrl: string;
	invitationId: string;
	ownerUserId: string;
	snapshot: Record<string, unknown>;
	themeId: string;
}): void {
	const insert = runPsql(
		`insert into public.invitations (
			id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot,
			client_name, client_email, client_whatsapp, photos_received, created_by
		) values (
			${sqlLiteral(input.invitationId)}::uuid,
			${sqlLiteral(PREVIEW_FIXTURE_SLUG)},
			${sqlLiteral(PREVIEW_FIXTURE_TITLE)},
			${sqlLiteral(PREVIEW_FIXTURE_EVENT_TYPE)},
			'draft',
			${sqlLiteral(PREVIEW_FIXTURE_DEMO_ID)},
			${sqlLiteral(input.themeId)},
			'client',
			${sqlLiteral(JSON.stringify(input.snapshot))}::jsonb,
			'',
			'',
			'',
			false,
			${sqlLiteral(input.ownerUserId)}::uuid
		)
		on conflict (id) do nothing
		returning id::text;`,
		input.dbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (insert.status !== 0) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_CREATE_FAILED: Could not insert ${PREVIEW_FIXTURE_SLUG} (${insert.stderr.trim() || 'psql error'}).`,
		);
	}
}

/**
 * Ensure the Preview E2E publication fixture exists.
 * Idempotent when the canonical fixture is already present.
 */
export function ensurePreviewE2eFixture(options: {
	apply?: boolean;
	isInteractive?: boolean;
	authToken?: string;
	env?: NodeJS.ProcessEnv;
}): PreviewE2eFixtureResult {
	const apply = options.apply === true;
	const env = options.env ?? process.env;
	const dbUrl = resolvePreviewFixtureDbUrl(env);

	verifyPreviewWriteAuthorization({
		slug: PREVIEW_FIXTURE_SLUG,
		targets: ['preview'],
		apply,
		isInteractive: options.isInteractive,
		authToken: options.authToken,
		operation: PREVIEW_E2E_FIXTURE_OPERATION,
	});

	const ownerUserId = resolvePreviewAdminUser(dbUrl);
	const existing = loadActiveFixture(dbUrl);
	const invitationId =
		existing?.id ?? deriveDeterministicUuid('preview-e2e-fixture', PREVIEW_FIXTURE_SLUG);

	if (existing) {
		assertCanonicalExisting(existing, ownerUserId);
		ensureDraft(dbUrl, existing.id, apply);
		return {
			action: apply ? 'already_present' : 'dry_run_present',
			invitationId: existing.id,
			slug: PREVIEW_FIXTURE_SLUG,
			ownerUserId,
			dbUrlRedacted: redactDbUrl(dbUrl),
		};
	}

	const preset = findDemoPreset(PREVIEW_FIXTURE_DEMO_ID);
	if (!preset) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_DEMO_MISSING: Demo preset ${PREVIEW_FIXTURE_DEMO_ID} is not in the catalog.`,
		);
	}

	if (!apply) {
		return {
			action: 'dry_run_create',
			invitationId,
			slug: PREVIEW_FIXTURE_SLUG,
			ownerUserId,
			dbUrlRedacted: redactDbUrl(dbUrl),
		};
	}

	createFixtureRow({
		dbUrl,
		invitationId,
		ownerUserId,
		snapshot: { ...preset },
		themeId: preset.themeId,
	});
	ensureDraft(dbUrl, invitationId, true);

	const verified = loadActiveFixture(dbUrl);
	if (!verified) {
		throw new Error(
			`PREVIEW_E2E_FIXTURE_VERIFY_FAILED: ${PREVIEW_FIXTURE_SLUG} was not found after create.`,
		);
	}
	assertCanonicalExisting(verified, ownerUserId);

	return {
		action: 'created',
		invitationId: verified.id,
		slug: PREVIEW_FIXTURE_SLUG,
		ownerUserId,
		dbUrlRedacted: redactDbUrl(dbUrl),
	};
}
