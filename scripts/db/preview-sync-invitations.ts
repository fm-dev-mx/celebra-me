/**
 * preview-sync-invitations.ts — Production-to-Preview Invitation Mirror
 *
 * Synchronizes invitation-facing data from Production to the dedicated Preview
 * Supabase project. Supports --dry-run (report only) and --apply (mutate).
 *
 * Usage:
 *   pnpm db:preview:sync-invitations -- --dry-run
 *   pnpm db:preview:sync-invitations -- --apply
 *
 * Safety:
 *   - Rejects identical source and target project refs
 *   - Rejects Production as the write target
 *   - Rejects Preview as the source
 *   - Rejects unknown, local, or disposable targets
 *   - Requires explicit --apply for mutations
 *   - Does NOT create Auth users
 *   - Does NOT prune Preview-only records automatically
 *   - Never prints credentials in output
 *   - Never copies guests/claims/Auth/intake/commercial (EXCLUDED_TABLES)
 *   - TRUNCATE events CASCADE resets Preview RSVP children; re-provision fixtures after apply
 *
 * This is a Production→Preview content regression mirror, never a promotion path.
 * Contract: docs/core/content-parity-rsvp-isolation.md
 */

import { fail, redactDbUrl, getProdDbUrl, runPsql } from './db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles as getPreviewSecret } from './db-guard.ts';
import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES } from './db-target-config.ts';
import {
	assertProductionIsProd,
	assertPreviewIsPreview,
	assertNotSameProject,
	assertNotLocalTarget,
	assertNotDisposableTarget,
	resolvePreviewAdminUser,
	updatePreviewAdminRole,
	ensureHostProfile,
	getPreviewSupabaseUrl,
	getPreviewServiceRoleKey,
	deriveSupabaseUrlFromDbUrl,
	getProjectRefFromSupabaseUrl,
	buildStorageUrl,
	rewriteStorageUrl,
	type ProdContext,
	type PreviewContext,
} from './preview-sync-guards.ts';
import {
	queryTableJson,
	resolveColumns,
	countRows,
	upsertFromJson,
	truncateTable,
} from './preview-sync-db.ts';
import { syncAsset } from './preview-sync-storage.ts';
import {
	createReport,
	printReport,
	writeReportFile,
	type SyncReport,
} from './preview-sync-report.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREVIEW_EXPECTED_REF = 'iwipdvisoyerfdytuhwi';
const PROD_STORAGE_PATTERN =
	/https:\/\/ineitkdkyrxqyressllp\.supabase\.co\/storage\/v1\/object\/public\/invitation-assets\//g;

/** Invitation-facing tables upserted before the events shell remap (excludes events). */
const MIRROR_TABLES = CONTENT_MIRROR_TABLES.filter((table) => table !== 'events');

// ---------------------------------------------------------------------------
// CLI Arguments
// ---------------------------------------------------------------------------

interface SyncOptions {
	dryRun: boolean;
}

function parseArgs(): SyncOptions {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');

	if (!dryRun && !apply) {
		console.info('Usage:');
		console.info('  pnpm db:preview:sync-invitations -- --dry-run   (report only)');
		console.info('  pnpm db:preview:sync-invitations -- --apply     (execute)');
		console.info('');
		console.info('  --stale-candidates  Show Preview-only records not in Production');
		process.exit(0);
	}

	return { dryRun };
}

// ---------------------------------------------------------------------------
// JSON & Storage URL Scanning
// ---------------------------------------------------------------------------

function scanContentForProdStorageUrls(prodCtx: ProdContext): {
	rows: { table: string; id: string; foundUrls: string[] }[];
	total: number;
} {
	const found: { table: string; id: string; foundUrls: string[] }[] = [];
	const contentTables = ['published_invitation_content', 'invitation_content_drafts'] as const;
	const jsonbTables = ['invitations'] as const;
	const jsonbColumns = ['content', 'snapshot'];

	for (const table of [...contentTables, ...jsonbTables]) {
		const cols = resolveColumns(prodCtx.dbUrl, table);
		const applicableCols = cols.filter((c) => jsonbColumns.includes(c));
		if (applicableCols.length === 0) continue;
		const rows = queryTableJson(prodCtx.dbUrl, table);
		for (const row of rows) {
			const rowId = (row.id as string) || '(unknown)';
			const rowContent = applicableCols
				.map((col) => {
					const val = row[col];
					return typeof val === 'string' ? val : JSON.stringify(val ?? '');
				})
				.join(' ');
			const matches = [...rowContent.matchAll(PROD_STORAGE_PATTERN)];
			if (matches.length > 0) {
				const urls = [...new Set(matches.map((m) => m[0].replace(/\/[^/]+$/, '')))];
				found.push({ table, id: rowId, foundUrls: urls });
			}
		}
	}

	return { rows: found, total: found.length };
}

function scanInvitationAssetsForStoragePaths(prodCtx: ProdContext): string[] {
	const rows = queryTableJson(prodCtx.dbUrl, 'invitation_assets');
	return rows.map((r) => r.storage_path as string).filter(Boolean);
}

function scanContentReferencedStoragePaths(prodCtx: ProdContext): Set<string> {
	const refs = new Set<string>();
	const contentTables = ['published_invitation_content', 'invitation_content_drafts'] as const;
	const storagePathPattern =
		/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/invitation-assets\/([^\s"',\]]+)/g;

	for (const table of contentTables) {
		const rows = queryTableJson(prodCtx.dbUrl, table);
		for (const row of rows) {
			const contentStr =
				typeof row.content === 'string' ? row.content : JSON.stringify(row.content ?? '');
			let match;
			while ((match = storagePathPattern.exec(contentStr)) !== null) {
				refs.add(decodeURIComponent(match[1]));
			}
		}
	}
	return refs;
}

// ---------------------------------------------------------------------------
// Stale Candidate Detection (report-only, no mutations)
// ---------------------------------------------------------------------------

interface StaleCandidate {
	table: string;
	previewCount: number;
	staleIds: string[];
}

function detectStaleCandidates(prodDbUrl: string, previewDbUrl: string): StaleCandidate[] {
	const candidates: StaleCandidate[] = [];

	for (const table of MIRROR_TABLES) {
		const columns = resolveColumns(prodDbUrl, table);
		const pk = columns.includes('id') ? 'id' : columns[0] || 'id';

		const prodResult = runPsql(
			`select ${pk}::text from public.${table} order by ${pk};`,
			prodDbUrl,
			{ tuplesOnly: true },
		);
		const prodIds = new Set(prodResult.stdout.trim().split(/\r?\n/).filter(Boolean));

		const previewResult = runPsql(
			`select ${pk}::text from public.${table} order by ${pk};`,
			previewDbUrl,
			{ tuplesOnly: true, throwOnError: false },
		);
		const previewIds = previewResult.stdout.trim().split(/\r?\n/).filter(Boolean);
		const candidateIds = previewIds.filter((id) => id.length > 0 && !prodIds.has(id));

		if (candidateIds.length > 0) {
			candidates.push({ table, previewCount: previewIds.length, staleIds: candidateIds });
		}
	}
	return candidates;
}

// ---------------------------------------------------------------------------
// Event Memberships — reconcile only for mirrored events
// ---------------------------------------------------------------------------

function reconcileEventMemberships(
	previewDbUrl: string,
	previewAdminUserId: string,
	mirroredEventIds: string[],
	dryRun: boolean,
	report: SyncReport,
): void {
	if (mirroredEventIds.length === 0) return;

	if (dryRun) {
		console.info(
			`   [dry-run] Would ensure owner membership for ${mirroredEventIds.length} mirrored events`,
		);
		return;
	}

	for (const eventId of mirroredEventIds) {
		// Upsert the admin membership — does NOT remove existing memberships for unmanaged events
		runPsql(
			`insert into public.event_memberships (event_id, user_id, membership_role)
			 values ('${eventId}'::uuid, '${previewAdminUserId}'::uuid, 'owner')
			 on conflict (event_id, user_id) do update set membership_role = 'owner';`,
			previewDbUrl,
		);
	}
	report.created['event_memberships'] =
		(report.created['event_memberships'] || 0) + mirroredEventIds.length;
}

// ---------------------------------------------------------------------------
// Execution Phases
// ---------------------------------------------------------------------------

interface Phase {
	name: string;
	action: () => void | Promise<void>;
}

function buildPhases(
	options: SyncOptions,
	prodCtx: ProdContext,
	previewCtx: PreviewContext,
	report: SyncReport,
): Phase[] {
	return [
		// Phase 1: Resolve and update Preview admin
		{
			name: 'Preview admin resolution',
			action: () => {
				console.info('\n📋 Phase 1: Preview admin');
				const userId = resolvePreviewAdminUser(previewCtx.dbUrl);
				updatePreviewAdminRole(previewCtx.dbUrl, userId);
				ensureHostProfile(previewCtx.dbUrl, userId);
				previewCtx.previewAdminUserId = userId;
				console.info(`   Preview admin user ID: ${userId}`);
				console.info(`   Role and profile updated (no Auth user created)`);
			},
		},

		// Phase 2: Scan Production Storage URLs in content
		{
			name: 'Storage URL scan',
			action: () => {
				console.info('\n📋 Phase 2: Scanning content for Production Storage URLs');

				const referencedPaths = scanContentReferencedStoragePaths(prodCtx);
				const assetPaths = new Set(scanInvitationAssetsForStoragePaths(prodCtx));
				const unregistered = [...referencedPaths].filter((p) => !assetPaths.has(p));

				if (unregistered.length > 0) {
					console.warn(
						`   ⚠️  ${unregistered.length} Storage references not registered in invitation_assets:`,
					);
					for (const p of unregistered) {
						console.warn(`       ${p}`);
					}
				}

				console.info(`   Registered assets: ${assetPaths.size}`);
				console.info(`   Content-referenced paths: ${referencedPaths.size}`);

				if (unregistered.length > 0) {
					report.detectedDrift.push(
						`${unregistered.length} Storage references not in invitation_assets`,
					);
				}
			},
		},

		// Phase 3: Sync invitation tables
		...MIRROR_TABLES.map((table) => ({
			name: `Sync table: ${table}`,
			action: () => {
				console.info(`\n📋 Phase 3: Syncing ${table}`);
				const prodRows = queryTableJson(prodCtx.dbUrl, table);
				console.info(`   Production ${table}: ${prodRows.length} rows`);

				if (prodRows.length === 0) {
					console.info(`   No rows to sync for ${table}`);
					return;
				}

				const columns = resolveColumns(prodCtx.dbUrl, table);
				const pk = columns.includes('id') ? 'id' : columns[0] || 'id';

				// Remap user-ID foreign keys to Preview admin
				const userFkColumns = columns.filter((c) =>
					['created_by', 'owner_user_id', 'user_id'].includes(c),
				);
				// Nullify excluded-table foreign keys (submission_id references intake_submissions)
				const nullifyFkColumns = columns.filter((c) => ['submission_id'].includes(c));
				let transformedRows = prodRows.map((row) => {
					const newRow = { ...row };
					for (const fk of userFkColumns) {
						newRow[fk] = previewCtx.previewAdminUserId;
					}
					for (const fk of nullifyFkColumns) {
						newRow[fk] = null;
					}
					return newRow;
				});
				// Rewrite Production Storage URLs in JSONB columns
				const jsonBColumns = columns.filter((c) => ['content', 'snapshot'].includes(c));
				if (jsonBColumns.length > 0) {
					transformedRows = transformedRows.map((row) => {
						const newRow = { ...row };
						for (const col of jsonBColumns) {
							if (typeof newRow[col] === 'string') {
								newRow[col] = rewriteStorageUrl(
									newRow[col] as string,
									prodCtx.storageUrl,
									previewCtx.storageUrl,
								);
							} else if (typeof newRow[col] === 'object' && newRow[col] !== null) {
								newRow[col] = JSON.parse(
									rewriteStorageUrl(
										JSON.stringify(newRow[col]),
										prodCtx.storageUrl,
										previewCtx.storageUrl,
									),
								);
							}
						}
						return newRow;
					});
				}
				// transformContentRows was replaced by the generic JSONB handling above
				// and has been removed from preview-sync-db.ts

				if (options.dryRun) {
					console.info(`   [dry-run] Would upsert ${transformedRows.length} rows`);
					report.created[table] = (report.created[table] || 0) + transformedRows.length;
					return;
				}

				const result = upsertFromJson(previewCtx.dbUrl, table, transformedRows, pk);
				report.created[table] = (report.created[table] || 0) + result.created;
			},
		})),

		// Phase 4: Remap event ownership
		{
			name: 'Map events ownership',
			action: () => {
				console.info('\n📋 Phase 4: Remapping event ownership');
				const prodEvents = queryTableJson(prodCtx.dbUrl, 'events', 'id');
				console.info(`   Production events: ${prodEvents.length} rows`);

				const rsvpResetNote =
					'Preview events replaced via TRUNCATE CASCADE; RSVP children reset — re-run gated Preview fixture provisioning if needed';
				if (options.dryRun) {
					console.info(`   [dry-run] Would remap ${prodEvents.length} events`);
					console.info(`   [dry-run] ${rsvpResetNote}`);
					report.detectedDrift.push(rsvpResetNote);
					return;
				}

				// Truncate CASCADE resets Preview RSVP children (guests/claims/memberships).
				// Re-provision synthetic Preview fixtures after apply — never copy Production PII.
				truncateTable(previewCtx.dbUrl, 'events');
				const remappedEvents = prodEvents.map((row) => ({
					...row,
					owner_user_id: previewCtx.previewAdminUserId,
				}));
				upsertFromJson(previewCtx.dbUrl, 'events', remappedEvents, 'id');
				report.created['events'] = prodEvents.length;
				report.detectedDrift.push(rsvpResetNote);

				// Collect mirrored event IDs for membership reconciliation
				const mirroredEventIds = prodEvents.map((r) => r.id as string).filter(Boolean);
				reconcileEventMemberships(
					previewCtx.dbUrl,
					previewCtx.previewAdminUserId,
					mirroredEventIds,
					options.dryRun,
					report,
				);
			},
		},

		// Phase 5: Host profile already done in Phase 1

		// Phase 6: Storage sync
		{
			name: 'Storage sync',
			action: async () => {
				console.info('\n📋 Phase 6: Syncing Storage binaries');
				let previewServiceRoleKey: string;
				try {
					previewServiceRoleKey = getPreviewServiceRoleKey();
				} catch {
					console.warn(
						'   ⚠️  PREVIEW_SUPABASE_SERVICE_ROLE_KEY not configured — skipping Storage sync',
					);
					report.detectedDrift.push(
						'Storage sync skipped: missing PREVIEW_SUPABASE_SERVICE_ROLE_KEY',
					);
					return;
				}
				const assets = queryTableJson(prodCtx.dbUrl, 'invitation_assets', 'id');
				console.info(`   Production assets: ${assets.length} rows`);

				if (assets.length === 0) return;

				for (const asset of assets) {
					const storagePath = asset.storage_path as string;
					const bucket = (asset.bucket as string) || 'invitation-assets';
					if (!storagePath) {
						console.warn(`   ⚠️  Asset ${asset.id} has no storage_path`);
						continue;
					}
					const ok = await syncAsset(
						{ id: asset.id as string, storagePath, bucket },
						prodCtx.storageUrl,
						previewCtx.supabaseUrl,
						previewServiceRoleKey,
						options.dryRun,
						report,
					);
					if (!ok && !options.dryRun) {
						report.failures.push(`Storage upload failed for ${storagePath}`);
					}
				}
			},
		},

		// Phase 7: Stale candidate detection (report-only — no mutations)
		{
			name: 'Stale candidate detection',
			action: () => {
				console.info('\n📋 Phase 7: Detecting stale Preview records (report-only)');
				const candidates = detectStaleCandidates(prodCtx.dbUrl, previewCtx.dbUrl);
				if (candidates.length === 0) {
					console.info('   No stale candidates found.');
					return;
				}
				for (const c of candidates) {
					const msg = `${c.table}: ${c.staleIds.length} records in Preview not in Production (of ${c.previewCount} total)`;
					console.info(`   ⚠️  ${msg}`);
					console.info(`        Preview-only records — NOT automatically pruned.`);
					for (const id of c.staleIds.slice(0, 5)) {
						console.info(`         - ${id}`);
					}
					if (c.staleIds.length > 5) {
						console.info(`         - ... and ${c.staleIds.length - 5} more`);
					}
					report.detectedDrift.push(msg);
				}
				console.info(
					'\n   ℹ️  Automatic pruning is DISABLED to protect Preview-only records.',
				);
				console.info('   Review candidates above and prune manually if needed.');
			},
		},

		// Phase 8: Post-apply Production URL audit
		{
			name: 'Production URL audit',
			action: () => {
				console.info('\n📋 Phase 8: Auditing mirrored content for Production Storage URLs');
				if (options.dryRun) {
					console.info(
						'   (Skipped in dry-run — checked from Production side in Phase 2)',
					);
					return;
				}
				const { rows, total } = scanContentForProdStorageUrls({
					...prodCtx,
					dbUrl: previewCtx.dbUrl,
				});
				if (total > 0) {
					const msg = `${total} content row(s) still contain Production Storage URLs after mirror`;
					console.warn(`   ❌ ${msg}`);
					for (const r of rows) {
						console.warn(`       ${r.table}:${r.id}`);
					}
					report.detectedDrift.push(msg);
				} else {
					console.info(
						'   ✅ No Production Storage URLs found in mirrored Preview content.',
					);
				}
			},
		},

		// Phase 9: Excluded data verification
		{
			name: 'Excluded data verification',
			action: () => {
				console.info('\n📋 Phase 9: Excluded data verification');
				for (const table of EXCLUDED_TABLES) {
					const count = countRows(prodCtx.dbUrl, table);
					report.excludedTableCounts[table] = count;
					console.info(`   ${table}: ${count} rows (not copied)`);
				}
			},
		},
	];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const options = parseArgs();
	const report = createReport(options.dryRun);

	console.info('='.repeat(60));
	console.info('PRODUCTION → PREVIEW INVITATION SYNC');
	console.info('='.repeat(60));
	console.info(`Mode: ${options.dryRun ? 'DRY RUN (no mutations)' : 'APPLY'}`);
	console.info('');

	// Load credentials
	console.info('■ Loading credentials...');

	const { url: prodDbUrl } = getProdDbUrl();
	const previewDbUrl = getPreviewSecret('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!previewDbUrl) {
		fail('PREVIEW_DB_URL is not configured.');
	}
	report.source = prodDbUrl;
	report.target = previewDbUrl;

	// Run safety guards
	console.info('■ Running safety guards...');
	assertProductionIsProd(prodDbUrl, 'Source');
	assertPreviewIsPreview(previewDbUrl);
	assertNotSameProject(prodDbUrl, previewDbUrl);
	assertNotLocalTarget(previewDbUrl);
	assertNotDisposableTarget(previewDbUrl);

	// Build contexts using the centralized ref resolver
	const prodSupabaseUrl = deriveSupabaseUrlFromDbUrl(prodDbUrl);
	const prodProjectRef = getProjectRefFromSupabaseUrl(prodSupabaseUrl);
	const prodStorageUrl = buildStorageUrl(prodSupabaseUrl);

	const previewSupabaseUrl = getPreviewSupabaseUrl();
	const previewProjectRef = getProjectRefFromSupabaseUrl(previewSupabaseUrl);
	const previewStorageUrl = buildStorageUrl(previewSupabaseUrl);

	console.info(`   Production project: ${prodProjectRef}`);
	console.info(`   Preview project:    ${previewProjectRef}`);

	if (previewProjectRef !== PREVIEW_EXPECTED_REF) {
		fail(
			`Preview project ref "${previewProjectRef}" does not match known ` +
				`dedicated project "${PREVIEW_EXPECTED_REF}". Aborting for safety.`,
		);
	}

	const prodCtx: ProdContext = {
		dbUrl: prodDbUrl,
		dbHost: '',
		supabaseUrl: prodSupabaseUrl,
		supabaseProjectRef: prodProjectRef,
		storageUrl: prodStorageUrl,
	};

	const previewCtx: PreviewContext = {
		dbUrl: previewDbUrl,
		supabaseUrl: previewSupabaseUrl,
		supabaseServiceRoleKey: '',
		supabaseProjectRef: previewProjectRef,
		storageUrl: previewStorageUrl,
		previewAdminUserId: '',
	};

	// Build and execute phases
	const phases = buildPhases(options, prodCtx, previewCtx, report);
	console.info(
		`\n■ Execution plan has ${phases.length} phases${options.dryRun ? ' (dry-run)' : ''}`,
	);

	for (const phase of phases) {
		try {
			const result = phase.action();
			if (result instanceof Promise) {
				await result;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			report.failures.push(`${phase.name}: ${msg}`);
			console.warn(`\n❌ Phase "${phase.name}" failed: ${msg}`);
			break;
		}
	}

	// Finalize
	const hasFailures = report.failures.length > 0;
	report.status = hasFailures ? 'failed' : options.dryRun ? 'dry-run-pending' : 'applied';

	printReport(report, redactDbUrl);
	writeReportFile(report, redactDbUrl);

	process.exit(hasFailures ? 1 : 0);
}

void main().catch((err: unknown) => {
	console.error('\n❌ UNEXPECTED ERROR:');
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
