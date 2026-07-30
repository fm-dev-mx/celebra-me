/**
 * content-parity-cli.ts — Read-only cross-environment semantic content parity.
 *
 * Usage:
 *   pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production]
 *
 * This command never mutates any database. Credential presence and runtime target do not
 * authorize Preview/Production writes.
 */

import { getProdDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	PREVIEW_SECRET_FILES,
	getSecretFromEnvOrFiles,
	LOCAL_DB_URL,
} from '../db/db-guard.ts';
import {
	buildSemanticInvitationSnapshot,
	compareAcrossEnvironments,
	type ContentParityEnvironment,
	type SemanticInvitationSnapshot,
} from './content-parity.ts';

interface CliOptions {
	slug: string;
	eventType: string;
	envs: ContentParityEnvironment[];
}

function parseArgs(argv: string[]): CliOptions {
	let slug = '';
	let eventType = '';
	let envs: ContentParityEnvironment[] = ['local', 'preview', 'production'];

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--slug') slug = String(argv[++i] || '').trim();
		else if (arg === '--event-type') eventType = String(argv[++i] || '').trim();
		else if (arg === '--envs') {
			envs = String(argv[++i] || '')
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean) as ContentParityEnvironment[];
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
	}

	if (!slug || !eventType) {
		printHelp();
		process.exit(1);
	}

	const allowed: ContentParityEnvironment[] = ['local', 'preview', 'production'];
	for (const env of envs) {
		if (!allowed.includes(env)) {
			console.error(`Unknown environment "${env}". Allowed: ${allowed.join(', ')}`);
			process.exit(1);
		}
	}
	if (envs.length < 2) {
		console.error('Provide at least two environments via --envs.');
		process.exit(1);
	}

	return { slug, eventType, envs };
}

function printHelp(): void {
	console.info(`Read-only semantic invitation content parity.

Usage:
  pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production]

Compares invitation-facing semantic state only. Never reads or compares guests, claims,
Auth, intake, analytics, or commercial tables. Never mutates any target.

See docs/core/content-parity-rsvp-isolation.md.`);
}

function resolveDbUrl(env: ContentParityEnvironment): string | null {
	if (env === 'local') {
		return process.env.LOCAL_DB_URL?.trim() || LOCAL_DB_URL;
	}
	if (env === 'preview') {
		const url = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
		return url.trim() || null;
	}
	try {
		return getProdDbUrl().url;
	} catch {
		return process.env.PROD_DB_URL?.trim() || null;
	}
}

function queryJson(dbUrl: string, sql: string): unknown {
	const result = runPsql(`select row_to_json(t) from (${sql}) t;`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const text = result.stdout.trim();
	if (!text) return null;
	return JSON.parse(text) as unknown;
}

function queryJsonArray(dbUrl: string, sql: string): unknown[] {
	const result = runPsql(`select coalesce(json_agg(t), '[]'::json) from (${sql}) t;`, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const text = result.stdout.trim();
	if (!text) return [];
	const parsed = JSON.parse(text) as unknown;
	return Array.isArray(parsed) ? parsed : [];
}

function loadSnapshot(
	env: ContentParityEnvironment,
	slug: string,
	eventType: string,
): SemanticInvitationSnapshot | null {
	const dbUrl = resolveDbUrl(env);
	if (!dbUrl) {
		console.warn(`[${env}] skipped: database URL not configured`);
		return null;
	}

	const invitation = queryJson(
		dbUrl,
		`select id, slug, event_type, kind, base_demo_id, theme_id, snapshot
		 from public.invitations
		 where slug = ${sqlLiteral(slug)}
		   and event_type = ${sqlLiteral(eventType)}
		   and archived_at is null
		 order by created_at desc
		 limit 1`,
	) as {
		id: string;
		slug: string;
		event_type: string;
		kind: string;
		base_demo_id?: string | null;
		theme_id?: string | null;
		snapshot?: unknown;
	} | null;

	if (!invitation) {
		console.warn(`[${env}] no invitation found for ${eventType}/${slug}`);
		return null;
	}

	const invitationIdSql = `${sqlLiteral(invitation.id)}::uuid`;

	const draft = queryJson(
		dbUrl,
		`select content
		 from public.invitation_content_drafts
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 order by updated_at desc
		 limit 1`,
	) as { content?: unknown } | null;

	const published = queryJson(
		dbUrl,
		`select content, is_demo
		 from public.published_invitation_content
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 order by version desc
		 limit 1`,
	) as {
		content?: unknown;
		is_demo?: boolean;
	} | null;

	const assets = queryJsonArray(
		dbUrl,
		`select managed_source_key, display_name, sha256
		 from public.invitation_assets
		 where invitation_id = ${invitationIdSql}
		   and deleted_at is null`,
	) as Array<{
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
	}>;

	const event = queryJson(
		dbUrl,
		`select slug, event_type
		 from public.events
		 where invitation_project_id = ${invitationIdSql}
		   and deleted_at is null
		 limit 1`,
	) as { slug?: string; event_type?: string } | null;

	return buildSemanticInvitationSnapshot({
		invitation,
		draftContent: draft?.content ?? null,
		published,
		assets,
		event,
	});
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	console.info('Content parity check (read-only; no mutations authorized by this command)');
	console.info(`Slug: ${options.slug}  Event type: ${options.eventType}`);
	console.info(`Environments: ${options.envs.join(', ')}`);

	const snapshots: Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>> = {};
	for (const env of options.envs) {
		const snapshot = loadSnapshot(env, options.slug, options.eventType);
		if (snapshot) snapshots[env] = snapshot;
	}

	const loaded = Object.keys(snapshots);
	if (loaded.length < 2) {
		console.error(
			`Need at least two loaded environments to compare; loaded: ${loaded.join(', ') || '(none)'}`,
		);
		process.exit(1);
	}

	const result = compareAcrossEnvironments(options.slug, options.eventType, snapshots);
	if (result.ok) {
		console.info(`PASS: semantic parity across ${result.environments.join(', ')}`);
		process.exit(0);
	}

	console.error(`FAIL: ${result.drifts.length} semantic drift(s)`);
	for (const drift of result.drifts) {
		console.error(
			`- [${drift.environments.join(' vs ')}] ${drift.entity}.${drift.field}: ${drift.detail}`,
		);
	}
	process.exit(1);
}

main();
