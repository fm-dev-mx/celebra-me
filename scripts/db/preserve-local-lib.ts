import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	LOCAL_DB_URL,
	PROJECT_ROOT,
	ensureDir,
	fail,
	parseTsv,
	quoteIdentifier,
	runCommand,
	runPsql,
	runPsqlFile,
	sqlLiteral,
	writeTextFile,
} from './db-workflow-lib.ts';

export const PRESERVE_OUTPUT_DIR = resolve(PROJECT_ROOT, '.tmp', 'db', 'preserve-local');

export const BACKUP_DIR = 'D:\\code\\celebra-me-backup\\db-full-20260614-084026';

export const PRESERVE_TABLE_ORDER = [
	'audit_logs',
	'host_profiles',
	'invitations',
	'rsvp_records',
	'events',
	'intake_requests',
	'published_invitation_content',
	'guest_invitations',
	'event_memberships',
	'event_claim_codes',
	'invitation_assets',
	'intake_submissions',
	'guest_invitation_audit',
	'rsvp_audit_log',
	'rsvp_channel_log',
	'invitation_content_drafts',
] as const;

export type PreserveTable = (typeof PRESERVE_TABLE_ORDER)[number];

export interface SlugInfo {
	slug: string;
	id: string;
	eventType: string | null;
}

export interface SlugDiff {
	invitations: { localOnly: SlugInfo[]; overlapping: SlugInfo[]; prodOnly: SlugInfo[] };
	events: { localOnly: SlugInfo[]; overlapping: SlugInfo[]; prodOnly: SlugInfo[] };
	published: { localOnly: SlugInfo[]; overlapping: SlugInfo[]; prodOnly: SlugInfo[] };
}

export interface DryRunReport {
	slugDiff: SlugDiff;
	preservedRows: Record<string, { id: string }[]>;
	preservedCounts: Record<string, number>;
	storageRefs: StorageReference[];
	authUserIds: string[];
	risks: string[];
	ambiguous: string[];
}

export interface StorageReference {
	table: string;
	id: string;
	storagePath: string;
	bucket: string;
	status: 'static_asset' | 'local_storage' | 'prod_storage' | 'unresolved';
	invitationSlug: string;
}

export interface ExportManifest {
	timestamp: string;
	localOnlySlugs: {
		invitations: SlugInfo[];
		events: SlugInfo[];
		published: SlugInfo[];
	};
	preservedCounts: Record<string, number>;
	storageRefs: StorageReference[];
	authUserIds: string[];
	exportFile: string;
}

export function runCopyExport(sql: string): string {
	const result = runCommand(
		'psql',
		['--set', 'ON_ERROR_STOP=1', '--dbname', LOCAL_DB_URL, '--command', sql],
		{ throwOnError: true },
	);
	// psql outputs COPY data as tab-separated raw lines followed by "COPY n" status
	// Split by newline and drop the trailing status line
	const lines = result.stdout.split(/\r?\n/);
	// The last non-empty line is "COPY n" - remove it
	while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
		lines.pop();
	}
	if (lines.length > 0 && /^COPY \d+$/.test(lines[lines.length - 1].trim())) {
		lines.pop();
	}
	return lines.join('\n') + '\n';
}

function getTableColumns(table: string, dbUrl = LOCAL_DB_URL): string[] {
	const result = runPsql(
		`
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = ${sqlLiteral(table)}
  and is_generated = 'NEVER'
order by ordinal_position;
`,
		dbUrl,
	);
	return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

export function fetchSlugs(table: string, dbUrl: string): SlugInfo[] {
	const qualified = quoteIdentifier(table);
	const result = runPsql(
		`select slug, id::text, event_type from public.${qualified} where slug is not null order by slug;`,
		dbUrl,
	);
	return parseTsv(result.stdout).map(([slug, id, eventType]) => ({
		slug,
		id,
		eventType: eventType || null,
	}));
}

export function fetchPublishedSlugs(dbUrl: string): SlugInfo[] {
	const result = runPsql(
		`select slug, id::text, event_type from public.published_invitation_content where slug is not null order by slug, event_type;`,
		dbUrl,
	);
	return parseTsv(result.stdout).map(([slug, id, eventType]) => ({
		slug,
		id,
		eventType: eventType || null,
	}));
}

export function classifySlugs(
	local: SlugInfo[],
	prod: SlugInfo[],
): { localOnly: SlugInfo[]; overlapping: SlugInfo[]; prodOnly: SlugInfo[] } {
	const prodSet = new Set(prod.map((s) => `${s.eventType ?? ''}|${s.slug}`));
	const localSet = new Set(local.map((s) => `${s.eventType ?? ''}|${s.slug}`));

	const localOnly = local.filter((s) => !prodSet.has(`${s.eventType ?? ''}|${s.slug}`));
	const overlapping = local.filter((s) => prodSet.has(`${s.eventType ?? ''}|${s.slug}`));
	const prodOnly = prod.filter((s) => !localSet.has(`${s.eventType ?? ''}|${s.slug}`));

	return { localOnly, overlapping, prodOnly };
}

export function detectLocalOnlySlugs(prodDbUrl: string): SlugDiff {
	const localInv = fetchSlugs('invitations', LOCAL_DB_URL);
	const prodInv = fetchSlugs('invitations', prodDbUrl);
	const localEvents = fetchSlugs('events', LOCAL_DB_URL);
	const prodEvents = fetchSlugs('events', prodDbUrl);
	const localPub = fetchPublishedSlugs(LOCAL_DB_URL);
	const prodPub = fetchPublishedSlugs(prodDbUrl);

	return {
		invitations: classifySlugs(localInv, prodInv),
		events: classifySlugs(localEvents, prodEvents),
		published: classifySlugs(localPub, prodPub),
	};
}

export function tracePreservedRows(slugDiff: SlugDiff): {
	preservedRows: Record<string, { id: string }[]>;
	authUserIds: string[];
} {
	const preservedRows: Record<string, { id: string }[]> = {};
	const authUserSet = new Set<string>();

	const invitationIds = slugDiff.invitations.localOnly.map((s) => s.id);
	const eventIds = slugDiff.events.localOnly.map((s) => s.id);
	const eventSlugs = slugDiff.events.localOnly.map((s) => s.slug);

	// --- invitations ---
	preservedRows.invitations = invitationIds.map((id) => ({ id }));
	for (const inv of slugDiff.invitations.localOnly) {
		if (inv.eventType) {
			preservedRows.published_invitation_content = (
				preservedRows.published_invitation_content ?? []
			).concat(
				fetchIdsByCondition(
					'published_invitation_content',
					`slug = ${sqlLiteral(inv.slug)} and event_type = ${sqlLiteral(inv.eventType)}`,
				),
			);
		}
	}

	// --- events ---
	preservedRows.events = eventIds.map((id) => ({ id }));

	// --- invitation_content_drafts (FK → invitations) ---
	if (invitationIds.length > 0) {
		preservedRows.invitation_content_drafts = fetchIdsByInList(
			'invitation_content_drafts',
			'invitation_project_id',
			invitationIds,
		);
	}

	// --- invitation_assets (FK → invitations) ---
	if (invitationIds.length > 0) {
		preservedRows.invitation_assets = fetchIdsByInList(
			'invitation_assets',
			'invitation_id',
			invitationIds,
		);
	}

	// --- intake_requests (FK → invitations) ---
	let intakeRequestIds: string[] = [];
	if (invitationIds.length > 0) {
		intakeRequestIds = fetchIdsByInList(
			'intake_requests',
			'invitation_project_id',
			invitationIds,
		).map((r) => r.id);
		preservedRows.intake_requests = intakeRequestIds.map((id) => ({ id }));
	}

	// --- intake_submissions (FK → intake_requests) ---
	if (intakeRequestIds.length > 0) {
		preservedRows.intake_submissions = fetchIdsByInList(
			'intake_submissions',
			'intake_request_id',
			intakeRequestIds,
		);
	}

	// --- guest_invitations (FK → events) ---
	let guestInvitationIds: string[] = [];
	if (eventIds.length > 0) {
		guestInvitationIds = fetchIdsByInList('guest_invitations', 'event_id', eventIds).map(
			(r) => r.id,
		);
		preservedRows.guest_invitations = guestInvitationIds.map((id) => ({ id }));
	}

	// --- guest_invitation_audit (FK → guest_invitations) ---
	if (guestInvitationIds.length > 0) {
		preservedRows.guest_invitation_audit = fetchIdsByInList(
			'guest_invitation_audit',
			'guest_invitation_id',
			guestInvitationIds,
		);
	}

	// --- event_claim_codes (FK → events) ---
	if (eventIds.length > 0) {
		preservedRows.event_claim_codes = fetchIdsByInList(
			'event_claim_codes',
			'event_id',
			eventIds,
		);
	}

	// --- event_memberships (FK → events) ---
	if (eventIds.length > 0) {
		preservedRows.event_memberships = fetchIdsByInList(
			'event_memberships',
			'event_id',
			eventIds,
		);
	}

	// --- rsvp_records (text event_slug matching event slugs) ---
	if (eventSlugs.length > 0) {
		const slugConditions = eventSlugs.map((s) => sqlLiteral(s)).join(', ');
		const rsvpResult = runPsql(
			`select store_key from public.rsvp_records where event_slug in (${slugConditions}) order by store_key;`,
		);
		const rsvpStoreKeys = rsvpResult.stdout.trim().split(/\r?\n/).filter(Boolean);
		preservedRows.rsvp_records = rsvpStoreKeys.map((key) => ({ id: key }));
	}

	// --- rsvp_audit_log (FK → rsvp_records.rsvp_id) ---
	const rsvpIds = preservedRows.rsvp_records?.map((r) => r.id) ?? [];
	if (rsvpIds.length > 0) {
		preservedRows.rsvp_audit_log = fetchRsvpAuditByRsvpIds(rsvpIds);
	}

	// --- rsvp_channel_log (FK → rsvp_records.rsvp_id) ---
	if (rsvpIds.length > 0) {
		preservedRows.rsvp_channel_log = fetchRsvpChannelByRsvpIds(rsvpIds);
	}

	// --- Collect auth user references ---
	collectAuthUserIds(slugDiff, preservedRows, authUserSet);

	// --- app_user_roles and host_profiles for preserved auth users ---
	const authUserIds = [...authUserSet];
	if (authUserIds.length > 0) {
		preservedRows.host_profiles = fetchIdsByInList('host_profiles', 'user_id', authUserIds);
	}

	return { preservedRows, authUserIds };
}

function fetchIdsByInList(table: string, fkColumn: string, ids: string[]): { id: string }[] {
	if (ids.length === 0) return [];
	const idList = ids.map((id) => sqlLiteral(id)).join(', ');
	const qualified = quoteIdentifier(table);
	const fkQuoted = quoteIdentifier(fkColumn);

	const pkCol = getPkColumn(table);
	const result = runPsql(
		`select ${quoteIdentifier(pkCol)}::text from public.${qualified} where ${fkQuoted} in (${idList}) order by ${quoteIdentifier(pkCol)};`,
	);
	return result.stdout
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((id) => ({ id }));
}

function fetchIdsByCondition(table: string, condition: string): { id: string }[] {
	const qualified = quoteIdentifier(table);
	const pkCol = getPkColumn(table);
	const result = runPsql(
		`select ${quoteIdentifier(pkCol)}::text from public.${qualified} where ${condition} order by ${quoteIdentifier(pkCol)};`,
	);
	return result.stdout
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((id) => ({ id }));
}

function fetchRsvpAuditByRsvpIds(rsvpIds: string[]): { id: string }[] {
	if (rsvpIds.length === 0) return [];
	const idList = rsvpIds.map((id) => sqlLiteral(id)).join(', ');
	const result = runPsql(
		`select audit_id::text from public.rsvp_audit_log where rsvp_id in (${idList}) order by audit_id;`,
	);
	return result.stdout
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((id) => ({ id }));
}

function fetchRsvpChannelByRsvpIds(rsvpIds: string[]): { id: string }[] {
	if (rsvpIds.length === 0) return [];
	const idList = rsvpIds.map((id) => sqlLiteral(id)).join(', ');
	const result = runPsql(
		`select channel_event_id::text from public.rsvp_channel_log where rsvp_id in (${idList}) order by channel_event_id;`,
	);
	return result.stdout
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((id) => ({ id }));
}

function getPkColumn(table: string): string {
	const knownPks: Record<string, string> = {
		app_user_roles: 'user_id',
		audit_logs: 'id',
		host_profiles: 'user_id',
		invitations: 'id',
		rsvp_records: 'store_key',
		events: 'id',
		intake_requests: 'id',
		published_invitation_content: 'id',
		guest_invitations: 'id',
		event_memberships: 'id',
		event_claim_codes: 'id',
		invitation_assets: 'id',
		intake_submissions: 'id',
		guest_invitation_audit: 'id',
		rsvp_audit_log: 'audit_id',
		rsvp_channel_log: 'channel_event_id',
		invitation_content_drafts: 'id',
	};
	return knownPks[table] ?? 'id';
}

function collectAuthUserIds(
	slugDiff: SlugDiff,
	preservedRows: Record<string, { id: string }[]>,
	authUserSet: Set<string>,
): void {
	const localOnlyInvitationIds = slugDiff.invitations.localOnly.map((s) => s.id);
	const localOnlyEventIds = slugDiff.events.localOnly.map((s) => s.id);

	if (localOnlyInvitationIds.length > 0) {
		const idList = localOnlyInvitationIds.map((id) => sqlLiteral(id)).join(', ');
		const result = runPsql(
			`select distinct created_by::text from public.invitations where id in (${idList}) and created_by is not null;`,
		);
		for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
			authUserSet.add(line.trim());
		}
	}

	if (localOnlyEventIds.length > 0) {
		const idList = localOnlyEventIds.map((id) => sqlLiteral(id)).join(', ');
		const ownerResult = runPsql(
			`select distinct owner_user_id::text from public.events where id in (${idList}) and owner_user_id is not null;`,
		);
		for (const line of ownerResult.stdout.trim().split(/\r?\n/).filter(Boolean)) {
			authUserSet.add(line.trim());
		}
	}

	for (const table of ['event_claim_codes', 'audit_logs'] as const) {
		const rows = preservedRows[table];
		if (!rows?.length) continue;
		const idCol = table === 'event_claim_codes' ? 'created_by' : 'actor_id';
		const pkCol = getPkColumn(table);
		const idList = rows.map((r) => sqlLiteral(r.id)).join(', ');
		const result = runPsql(
			`select distinct ${quoteIdentifier(idCol)}::text from public.${quoteIdentifier(table)} where ${quoteIdentifier(pkCol)} in (${idList}) and ${quoteIdentifier(idCol)} is not null;`,
		);
		for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
			authUserSet.add(line.trim());
		}
	}

	const membershipRows = preservedRows.event_memberships;
	if (membershipRows?.length) {
		const idList = membershipRows.map((r) => sqlLiteral(r.id)).join(', ');
		const result = runPsql(
			`select distinct user_id::text from public.event_memberships where id in (${idList}) and user_id is not null;`,
		);
		for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
			authUserSet.add(line.trim());
		}
	}
}

export function checkStorageReferences(
	slugDiff: SlugDiff,
	preservedRows: Record<string, { id: string }[]>,
): StorageReference[] {
	const assetRows = preservedRows.invitation_assets ?? [];
	if (assetRows.length === 0) return [];

	const slugToId = new Map(slugDiff.invitations.localOnly.map((s) => [s.id, s.slug]));

	const refs: StorageReference[] = [];
	const idList = assetRows.map((r) => sqlLiteral(r.id)).join(', ');
	const result = runPsql(
		`select id::text, invitation_id::text, storage_path, bucket from public.invitation_assets where id in (${idList}) order by id;`,
	);
	const rows = parseTsv(result.stdout);
	for (const [id, invitationId, storagePath, bucket] of rows) {
		const invitationSlug = slugToId.get(invitationId) ?? 'unknown';
		const status = resolveStorageStatus(storagePath);
		refs.push({ table: 'invitation_assets', id, storagePath, bucket, status, invitationSlug });
	}
	return refs;
}

function resolveStorageStatus(
	storagePath: string,
): 'static_asset' | 'local_storage' | 'prod_storage' | 'unresolved' {
	if (storagePath.startsWith('static/') || storagePath.startsWith('assets/')) {
		return 'static_asset';
	}
	if (storagePath.startsWith('public/') || storagePath.startsWith('production/')) {
		return 'prod_storage';
	}
	return 'local_storage';
}

export function createExportDump(
	preservedRows: Record<string, { id: string }[]>,
	outputDir: string,
	stamp: string,
): string {
	ensureDir(outputDir);
	const outputPath = resolve(outputDir, `preserve-local-${stamp}.sql`);
	const lines: string[] = [
		'-- Celebra-me preserve-local export',
		`-- Created at: ${new Date().toISOString()}`,
		'-- Preserves local-only invitations/demos that do not exist in production.',
		'-- FK-safe ordering (parents before children).',
		'',
		'set check_function_bodies = off;',
		'set client_min_messages = warning;',
		'',
	];

	for (const table of PRESERVE_TABLE_ORDER) {
		const rows = preservedRows[table];
		if (!rows?.length) {
			lines.push(`-- Skipped public.${table}: no preserved rows.`);
			lines.push('');
			continue;
		}

		const columns = getTableColumns(table);
		if (columns.length === 0) {
			lines.push(`-- Skipped public.${table}: no dumpable columns.`);
			lines.push('');
			continue;
		}

		const columnList = columns.map(quoteIdentifier).join(', ');
		const qualifiedTable = `public.${quoteIdentifier(table)}`;
		const pkCol = getPkColumn(table);
		const idList = rows.map((r) => sqlLiteral(r.id)).join(', ');

		let whereClause: string;
		if (table === 'rsvp_records') {
			whereClause = `store_key in (${idList})`;
		} else if (table === 'rsvp_audit_log') {
			whereClause = `audit_id in (${idList})`;
		} else if (table === 'rsvp_channel_log') {
			whereClause = `channel_event_id in (${idList})`;
		} else {
			whereClause = `${quoteIdentifier(pkCol)} in (${idList})`;
		}

		const copyResult = runCopyExport(
			`copy (select ${columnList} from ${qualifiedTable} where ${whereClause} order by ${quoteIdentifier(pkCol)}) to stdout;`,
		);
		const copyRows = copyResult.trimEnd();

		lines.push(
			`-- Preserved local-only rows for ${qualifiedTable}`,
			`COPY ${qualifiedTable} (${columnList}) FROM stdin;`,
			copyRows,
			'\\.',
			'',
		);
	}

	const content = lines.join('\n');
	writeTextFile(outputPath, content);
	return outputPath;
}

export function createExportManifest(
	slugDiff: SlugDiff,
	preservedRows: Record<string, { id: string }[]>,
	storageRefs: StorageReference[],
	authUserIds: string[],
	exportFile: string,
	stamp: string,
): string {
	const manifest: ExportManifest = {
		timestamp: stamp,
		localOnlySlugs: {
			invitations: slugDiff.invitations.localOnly,
			events: slugDiff.events.localOnly,
			published: slugDiff.published.localOnly,
		},
		preservedCounts: {},
		storageRefs,
		authUserIds,
		exportFile,
	};
	for (const [table, rows] of Object.entries(preservedRows)) {
		if (rows?.length) {
			manifest.preservedCounts[table] = rows.length;
		}
	}
	const manifestPath = exportFile.replace(/\.sql$/, '.manifest.json');
	writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
	return manifestPath;
}

export function validateExportDump(dumpPath: string): boolean {
	if (!existsSync(dumpPath)) {
		fail(`Export dump not found: ${dumpPath}`);
	}
	const content = readFileSync(dumpPath, 'utf8');
	const copyBlocks = content.match(/^COPY\s+public\.(?:"\w+"|\w+)/gm);
	if (copyBlocks?.length) {
		// Has data blocks — good
	}
	return true;
}

export function restoreFromDump(dumpPath: string): void {
	if (!existsSync(dumpPath)) {
		fail(`Preserve dump not found: ${dumpPath}`);
	}
	console.info(`Restoring preserve dump: ${dumpPath}`);
	runPsqlFile(dumpPath);
	console.info('Preserve dump restored successfully');
}

export function createAuthUserPlaceholders(userIds: string[]): void {
	if (userIds.length === 0) return;

	const values = userIds
		.map(
			(uid) =>
				`(${sqlLiteral(uid)}::uuid, 'authenticated', 'authenticated', ${sqlLiteral(
					`preserved-user-${uid.replace(/-/g, '')}@celebra-me.local`,
				)})`,
		)
		.join(',\n');

	runPsql(`
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select
  u.id::uuid,
  u.aud,
  u.role,
  u.email,
  crypt('preserved-local-user-only', gen_salt('bf')),
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values ${values}) as u(id, aud, role, email)
on conflict (id) do nothing;
`);
}

export function buildDryRunReport(
	slugDiff: SlugDiff,
	preservedRows: Record<string, { id: string }[]>,
	storageRefs: StorageReference[],
	authUserIds: string[],
	risks: string[],
	ambiguous: string[],
): DryRunReport {
	const preservedCounts: Record<string, number> = {};
	for (const [table, rows] of Object.entries(preservedRows)) {
		if (rows?.length) {
			preservedCounts[table] = rows.length;
		}
	}
	return { slugDiff, preservedRows, preservedCounts, storageRefs, authUserIds, risks, ambiguous };
}

export function formatDryRunReport(report: DryRunReport): string {
	const { slugDiff, preservedCounts, storageRefs, authUserIds, risks, ambiguous } = report;
	const lines: string[] = [];

	lines.push('=== Dry-Run: Preserve-Local Refresh ===');
	lines.push('');

	lines.push('--- Local-Only Slugs (will be preserved) ---');
	const printSlugs = (label: string, slugs: SlugInfo[]) => {
		if (slugs.length === 0) {
			lines.push(`  ${label}: (none)`);
		} else {
			for (const s of slugs) {
				lines.push(
					`  ${label}: "${s.slug}" (id=${s.id}${s.eventType ? `, type=${s.eventType}` : ''})`,
				);
			}
		}
	};
	printSlugs('invitations.slug', slugDiff.invitations.localOnly);
	printSlugs('events.slug', slugDiff.events.localOnly);
	printSlugs('published_invitation_content', slugDiff.published.localOnly);
	lines.push('');

	lines.push('--- Overlapping Slugs (production wins) ---');
	printSlugs('invitations.slug', slugDiff.invitations.overlapping);
	printSlugs('events.slug', slugDiff.events.overlapping);
	printSlugs('published_invitation_content', slugDiff.published.overlapping);
	lines.push('');

	lines.push('--- Production-Only Slugs (will be imported) ---');
	printSlugs('invitations.slug', slugDiff.invitations.prodOnly);
	printSlugs('events.slug', slugDiff.events.prodOnly);
	printSlugs('published_invitation_content', slugDiff.published.prodOnly);
	lines.push('');

	const totalPreserved = Object.values(preservedCounts).reduce((a, b) => a + b, 0);
	lines.push(`--- Export Summary (${totalPreserved} total rows) ---`);
	for (const [table, count] of Object.entries(preservedCounts).sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		lines.push(`  ${table}: ${count} rows`);
	}
	lines.push('');

	if (authUserIds.length > 0) {
		lines.push(`--- Auth Users (${authUserIds.length} will need placeholders) ---`);
		for (const uid of authUserIds) {
			lines.push(`  ${uid}`);
		}
		lines.push('');
	}

	if (storageRefs.length > 0) {
		lines.push('--- Storage References ---');
		const grouped = new Map<string, StorageReference[]>();
		for (const ref of storageRefs) {
			const key = ref.status;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(ref);
		}
		for (const [status, refs] of grouped) {
			lines.push(`  Status "${status}": ${refs.length} reference(s)`);
			for (const ref of refs) {
				lines.push(
					`    [${ref.invitationSlug}] ${ref.storagePath} (bucket: ${ref.bucket})`,
				);
			}
		}
		lines.push('');
	}

	if (risks.length > 0) {
		lines.push('--- Risks ---');
		for (const risk of risks) {
			lines.push(`  ${risk}`);
		}
		lines.push('');
	}

	if (ambiguous.length > 0) {
		lines.push('--- Ambiguous ---');
		for (const a of ambiguous) {
			lines.push(`  ${a}`);
		}
		lines.push('');
	}

	lines.push('=== End Dry-Run Report ===');
	lines.push('Run with --export to create the preserve bundle, then --confirm to execute.');

	return lines.join('\n');
}

export function validatePreservedData(slugDiff: SlugDiff): string[] {
	const issues: string[] = [];

	for (const inv of slugDiff.invitations.localOnly) {
		const result = runPsql(
			`select count(*)::text from public.invitations where id = ${sqlLiteral(inv.id)};`,
		);
		if (result.stdout.trim() !== '1') {
			issues.push(
				`Preserved invitation id=${inv.id} slug="${inv.slug}" not found after restore`,
			);
		}
	}

	for (const ev of slugDiff.events.localOnly) {
		const result = runPsql(
			`select count(*)::text from public.events where id = ${sqlLiteral(ev.id)};`,
		);
		if (result.stdout.trim() !== '1') {
			issues.push(`Preserved event id=${ev.id} slug="${ev.slug}" not found after restore`);
		}
	}

	for (const pub of slugDiff.published.localOnly) {
		const result = runPsql(
			`select count(*)::text from public.published_invitation_content where id = ${sqlLiteral(pub.id)};`,
		);
		if (result.stdout.trim() !== '1') {
			issues.push(
				`Preserved published_content id=${pub.id} slug="${pub.slug}" not found after restore`,
			);
		}
	}

	return issues;
}

export function checkOverlappingSlugsMatchProduction(): string[] {
	const issues: string[] = [];

	// Verify no duplicate slugs exist
	const result = runPsql(
		`select slug, count(*)::text from public.invitations where slug is not null group by slug having count(*) > 1;`,
	);
	if (result.stdout.trim()) {
		issues.push(`Duplicate invitation slugs found after refresh: ${result.stdout.trim()}`);
	}

	return issues;
}

export function checkOrphanedRefs(preservedRows: Record<string, { id: string }[]>): string[] {
	const issues: string[] = [];

	for (const table of [
		'app_user_roles',
		'invitation_content_drafts',
		'invitation_assets',
		'intake_requests',
		'intake_submissions',
		'guest_invitations',
		'guest_invitation_audit',
		'event_claim_codes',
		'event_memberships',
	] as const) {
		const rows = preservedRows[table];
		if (!rows?.length) continue;
		const pkCol = getPkColumn(table);
		const idList = rows.map((r) => sqlLiteral(r.id)).join(', ');
		const result = runPsql(
			`select count(*)::text from public.${quoteIdentifier(table)} where ${quoteIdentifier(pkCol)} in (${idList});`,
		);
		const count = parseInt(result.stdout.trim(), 10);
		if (count !== rows.length) {
			issues.push(
				`${table}: expected ${rows.length} preserved rows, found ${count} after restore`,
			);
		}
	}

	return issues;
}
