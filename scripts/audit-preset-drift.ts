/**
 * audit-preset-drift.ts
 *
 * Read-only diagnostic. Detects theme/preset field mismatches across the
 * invitations table AND published_invitation_content for any environment.
 *
 * Usage:
 *   pnpm tsx scripts/audit-preset-drift.ts
 *
 * This script imports DEMO_PRESET_CATALOG directly, so it stays in sync
 * whenever the catalog changes — no hardcoded values to maintain.
 *
 * Safe to run in production. Does not write to the database.
 */

import { DEMO_PRESET_CATALOG } from '../src/lib/intake/demo-preset-catalog';
import { THEME_PRESETS } from '../src/lib/theme/theme-contract';

interface InvitationRow {
	id: string;
	kind: string;
	title: string;
	base_demo_id: string;
	theme_id: string;
	snapshot: Record<string, unknown> | null;
	archived_at: string | null;
}

interface PublishedRow {
	id: string;
	invitation_project_id: string;
	slug: string;
	event_type: string;
	content: Record<string, unknown>;
}

interface DriftItem {
	status: DriftStatus;
	description: string;
	scope: 'invitation' | 'published';
}

interface DriftReport {
	invitationId: string;
	kind: string;
	title: string;
	issues: DriftItem[];
	details: {
		themeId: string;
		baseDemoId: string;
		snapshotThemeId: string | undefined;
		snapshotId: string | undefined;
		catalogThemeId: string | undefined;
		publishedThemePreset: string | undefined;
		publishedInvitationId: string | undefined;
	};
}

type DriftStatus =
	| 'OK'
	| 'MISSING_SNAPSHOT'
	| 'INVALID_THEME_ID'
	| 'SNAPSHOT_THEME_MISMATCH'
	| 'SNAPSHOT_ID_MISMATCH'
	| 'UNKNOWN_BASE_DEMO'
	| 'CATALOG_THEME_MISMATCH'
	| 'PUBLISHED_THEME_MISMATCH'
	| 'PUBLISHED_NO_RECORD';

const VALID_THEMES = new Set<string>(THEME_PRESETS);

function detectInvitationDrift(row: InvitationRow, published?: PublishedRow): DriftReport {
	const snapshotThemeId = row.snapshot?.themeId as string | undefined;
	const snapshotId = row.snapshot?.id as string | undefined;
	const catalogEntry = DEMO_PRESET_CATALOG.find((p) => p.id === row.base_demo_id);
	const catalogThemeId = catalogEntry?.themeId;
	const publishedContent = published?.content as Record<string, unknown> | undefined;
	const publishedTheme = publishedContent?.theme as Record<string, unknown> | undefined;
	const publishedThemePreset = publishedTheme?.preset as string | undefined;

	const details = {
		themeId: row.theme_id,
		baseDemoId: row.base_demo_id,
		snapshotThemeId,
		snapshotId,
		catalogThemeId,
		publishedThemePreset,
		publishedInvitationId: published?.invitation_project_id,
	};

	const issues: DriftItem[] = [];

	const invStatus = detectInvitationLevelDrift(row, catalogEntry, snapshotThemeId, snapshotId);
	if (invStatus.status !== 'OK') {
		issues.push({ ...invStatus, scope: 'invitation' });
	}

	const pubStatus = detectPublishedDrift(row, published, publishedThemePreset);
	if (pubStatus) {
		issues.push({ ...pubStatus, scope: 'published' });
	}

	return {
		invitationId: row.id,
		kind: row.kind,
		title: row.title,
		issues,
		details,
	};
}

function detectInvitationLevelDrift(
	row: InvitationRow,
	catalogEntry: { themeId?: string } | undefined,
	snapshotThemeId: string | undefined,
	snapshotId: string | undefined,
): { status: DriftStatus; description: string } {
	if (!row.snapshot) {
		return { status: 'MISSING_SNAPSHOT', description: 'Invitación sin snapshot almacenado' };
	}
	if (!VALID_THEMES.has(row.theme_id)) {
		return {
			status: 'INVALID_THEME_ID',
			description: `theme_id="${row.theme_id}" no es un ThemePreset válido`,
		};
	}
	if (row.base_demo_id && !catalogEntry && row.base_demo_id !== '') {
		return {
			status: 'UNKNOWN_BASE_DEMO',
			description: `base_demo_id="${row.base_demo_id}" no se encuentra en DEMO_PRESET_CATALOG`,
		};
	}

	const catThemeId = catalogEntry?.themeId;
	if (catalogEntry && catThemeId && row.theme_id !== catThemeId) {
		return {
			status: 'CATALOG_THEME_MISMATCH',
			description: `theme_id="${row.theme_id}" ≠ catalog.themeId="${catThemeId}" para preset="${row.base_demo_id}"`,
		};
	}
	if (snapshotId && snapshotId !== row.base_demo_id) {
		return {
			status: 'SNAPSHOT_ID_MISMATCH',
			description: `snapshot.id="${snapshotId}" ≠ base_demo_id="${row.base_demo_id}"`,
		};
	}
	if (snapshotThemeId && snapshotThemeId !== row.theme_id) {
		return {
			status: 'SNAPSHOT_THEME_MISMATCH',
			description: `snapshot.themeId="${snapshotThemeId}" ≠ theme_id="${row.theme_id}"`,
		};
	}
	return { status: 'OK', description: 'Sin problemas' };
}

function detectPublishedDrift(
	row: InvitationRow,
	published: PublishedRow | undefined,
	publishedThemePreset: string | undefined,
): { status: DriftStatus; description: string } | null {
	if (!published) {
		return { status: 'PUBLISHED_NO_RECORD', description: 'No hay contenido publicado' };
	}
	if (publishedThemePreset && publishedThemePreset !== row.theme_id) {
		return {
			status: 'PUBLISHED_THEME_MISMATCH',
			description: `published.theme.preset="${publishedThemePreset}" ≠ theme_id="${row.theme_id}" (needs republish)`,
		};
	}
	return null;
}

function printReport(reports: DriftReport[]): { hasDrift: boolean } {
	const withIssues = reports.filter((r) => r.issues.length > 0);
	const okCount = reports.filter((r) => r.issues.length === 0).length;

	console.log(`\n=== THEME/PRESET DRIFT AUDIT ===\n`);
	console.log(`Total invitations: ${reports.length}`);
	console.log(`OK: ${okCount}`);
	console.log(`With issues: ${withIssues.length}\n`);

	for (const d of withIssues) {
		const tags = d.issues.map((i) => `[${i.status}/${i.scope}]`).join(' ');
		console.log(`${tags} ${d.title} (${d.invitationId.slice(0, 8)}...)`);
		for (const issue of d.issues) {
			console.log(`  ${issue.scope}: ${issue.description}`);
		}
		console.log(`  theme_id:        ${d.details.themeId}`);
		console.log(`  base_demo_id:    ${d.details.baseDemoId}`);
		console.log(`  snapshot.themeId: ${d.details.snapshotThemeId ?? '(null)'}`);
		console.log(`  snapshot.id:     ${d.details.snapshotId ?? '(null)'}`);
		console.log(`  catalog.themeId: ${d.details.catalogThemeId ?? '(not found)'}`);
		console.log(`  published.preset: ${d.details.publishedThemePreset ?? '(none)'}`);
		console.log('');
	}

	const invSummary = new Map<string, number>();
	const pubSummary = new Map<string, number>();
	for (const r of reports) {
		for (const issue of r.issues) {
			const map = issue.scope === 'invitation' ? invSummary : pubSummary;
			map.set(issue.status, (map.get(issue.status) ?? 0) + 1);
		}
		if (r.issues.length === 0) {
			invSummary.set('OK', (invSummary.get('OK') ?? 0) + 1);
		}
	}
	console.log('--- SUMMARY BY STATUS ---');
	console.log('  Invitation-level:');
	for (const [status, count] of invSummary) {
		console.log(`    ${status}: ${count}`);
	}
	console.log('  Published-content:');
	if (pubSummary.size > 0) {
		for (const [status, count] of pubSummary) {
			console.log(`    ${status}: ${count}`);
		}
	} else {
		console.log('    (no drift found)');
	}

	return { hasDrift: withIssues.length > 0 };
}

async function supabaseFetch<T>(baseUrl: string, path: string, key: string): Promise<T> {
	const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` },
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

async function main() {
	const supabaseUrl = process.env.SUPABASE_API_URL || process.env.PUBLIC_SUPABASE_API_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseKey) {
		console.error('SUPABASE_API_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
		process.exit(1);
	}

	const baseUrl = supabaseUrl.replace(/\/$/, '');

	const invitations = await supabaseFetch<InvitationRow[]>(
		baseUrl,
		'invitations?select=id,kind,title,base_demo_id,theme_id,snapshot,archived_at&archived_at=is.null&order=updated_at.desc',
		supabaseKey,
	);

	const publishedRows = await supabaseFetch<PublishedRow[]>(
		baseUrl,
		'published_invitation_content?select=id,invitation_project_id,slug,event_type,content&order=created_at.desc',
		supabaseKey,
	);

	const publishedByInvitation = new Map(publishedRows.map((r) => [r.invitation_project_id, r]));

	const reports: DriftReport[] = invitations.map((inv) =>
		detectInvitationDrift(inv, publishedByInvitation.get(inv.id)),
	);

	const { hasDrift } = printReport(reports);
	if (hasDrift && process.env.CI) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
