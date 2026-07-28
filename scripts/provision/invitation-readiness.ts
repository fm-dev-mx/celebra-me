/**
 * invitation-readiness.ts — Canonical TypeScript Readiness Evaluation Engine
 *
 * Evaluates managed invitation readiness for persistent-local database and Supabase Storage.
 * Verifies definition, DB state, provenance, asset integrity, and Storage binaries.
 *
 * Verdicts:
 *   READY   (0) — Every required condition was verified and satisfied.
 *   NO-GO   (1) — At least one required condition was conclusively verified and failed.
 *   BLOCKED (2) — Required condition could not be verified due to missing credentials/services.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';
import { resolveLocalEnv } from './local-provision-env.ts';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../../src/lib/intake/constants.ts';

export type ReadinessVerdict = 'READY' | 'NO-GO' | 'BLOCKED';

export interface ReadinessCheckResult {
	slug: string;
	verdict: ReadinessVerdict;
	exitCode: number;
	reasons: string[];
	details: {
		definitionFound: boolean;
		inventoryRowFound: boolean;
		isArchived: boolean;
		kind: string | null;
		hasProvenance: boolean;
		assetComplete: boolean;
		storageBinaryVerified: boolean;
		heroValid: boolean;
		mapsValid: boolean;
		noLocalPathLeak: boolean;
	};
}

type Details = ReadinessCheckResult['details'];

function verifyDefinition(slug: string, reasons: string[]): InvitationDefinition | null {
	const allDefs = listInvitationDefinitions();
	const defMatches = allDefs.filter((d) => d.slug === slug);
	if (defMatches.length === 0) {
		reasons.push(`Canonical definition for "${slug}" was not found.`);
		return null;
	}
	if (defMatches.length > 1) {
		reasons.push(`Multiple canonical definitions found for "${slug}" (${defMatches.length}).`);
		return null;
	}
	return getInvitationDefinition(slug);
}

async function verifyDbRow(
	supabase: SupabaseClient,
	slug: string,
	reasons: string[],
	details: Details,
): Promise<Record<string, unknown> | null> {
	const { data: invRows, error: invError } = await supabase
		.from('invitations')
		.select('id, slug, title, event_type, status, kind, archived_at')
		.eq('slug', slug);

	if (invError) {
		reasons.push(`Failed to query persistent-local database: ${invError.message}`);
		return null;
	}
	if (!invRows || invRows.length === 0) {
		reasons.push(`Persistent-local invitation record for "${slug}" does not exist.`);
		return null;
	}
	if (invRows.length > 1) {
		reasons.push(`Multiple persistent-local records found for "${slug}" (${invRows.length}).`);
		return null;
	}

	const inv = invRows[0] as Record<string, unknown>;
	details.inventoryRowFound = true;
	details.kind = inv.kind as string;

	if (inv.archived_at !== null) {
		details.isArchived = true;
		reasons.push(`Invitation "${slug}" is archived.`);
	}
	if (inv.kind !== 'client') {
		reasons.push(`Invitation record kind is "${inv.kind}" instead of "client".`);
	}
	return inv;
}

async function verifyDbAssets(
	supabase: SupabaseClient,
	invId: unknown,
	definition: InvitationDefinition,
	reasons: string[],
	details: Details,
): Promise<void> {
	const { data: dbAssets } = await supabase
		.from('invitation_assets')
		.select('*')
		.eq('invitation_id', invId)
		.is('deleted_at', null);

	const dbAssetsList = (dbAssets ?? []) as Array<Record<string, unknown>>;
	const dbAssetMapByDisplayName = new Map(dbAssetsList.map((a) => [a.display_name as string, a]));

	let missingAssetCount = 0;
	let corruptedStorageCount = 0;

	for (const spec of definition.assets) {
		const match = dbAssetMapByDisplayName.get(spec.displayName);
		if (!match) {
			missingAssetCount++;
			reasons.push(`Missing DB asset record for "${spec.displayName}" (key: ${spec.key}).`);
			continue;
		}
		const storagePath = match.storage_path as string;
		if (!storagePath || storagePath.includes('C:\\') || storagePath.includes('/Users/')) {
			reasons.push(
				`Local filesystem path leaked in storage_path for asset "${spec.displayName}".`,
			);
		}
		const mime = match.mime_type as string;
		if (!ALLOWED_MIME_TYPES.includes(mime)) {
			reasons.push(`Invalid MIME type "${mime}" for asset "${spec.displayName}".`);
		}
		const fileSize = Number(match.file_size);
		if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
			reasons.push(`Invalid file size ${fileSize} for asset "${spec.displayName}".`);
		}
		corruptedStorageCount += await verifyStorageBinary(supabase, storagePath, reasons);
	}

	if (missingAssetCount === 0) details.assetComplete = true;
	if (corruptedStorageCount === 0 && missingAssetCount === 0)
		details.storageBinaryVerified = true;
}

async function verifyStorageBinary(
	supabase: SupabaseClient,
	storagePath: string,
	reasons: string[],
): Promise<number> {
	try {
		const { data: binaryData, error: downloadErr } = await supabase.storage
			.from('invitation-assets')
			.download(storagePath);
		if (downloadErr || !binaryData || binaryData.size === 0) {
			reasons.push(
				`Storage binary missing or unreadable for "${storagePath}": ${downloadErr?.message}`,
			);
			return 1;
		}
		return 0;
	} catch (err) {
		reasons.push(
			`Storage download error for "${storagePath}": ${err instanceof Error ? err.message : String(err)}`,
		);
		return 1;
	}
}

function verifyPublishedContent(
	pubContent: Record<string, unknown> | undefined,
	reasons: string[],
	details: Details,
): void {
	if (!pubContent) {
		reasons.push('No published content version exists.');
		return;
	}
	const contentStr = JSON.stringify(pubContent);
	if (!contentStr.includes('C:\\') && !contentStr.includes('/Users/')) {
		details.noLocalPathLeak = true;
	} else {
		reasons.push('Local filesystem path leaked inside published content JSON.');
	}

	const hero = pubContent.hero as Record<string, unknown> | undefined;
	if (hero?.backgroundImage && typeof hero.backgroundImage === 'object') {
		details.heroValid = true;
	} else {
		reasons.push('Hero photograph reference missing or invalid in published content.');
	}

	const location = pubContent.location as Record<string, unknown> | undefined;
	const ceremony = location?.ceremony as Record<string, unknown> | undefined;
	const reception = location?.reception as Record<string, unknown> | undefined;
	const venues = [ceremony, reception].filter((venue): venue is Record<string, unknown> =>
		Boolean(venue && typeof venue === 'object'),
	);
	if (venues.length > 0) {
		if (venues.every((venue) => typeof venue.mapUrl === 'string' && venue.mapUrl.length > 0)) {
			details.mapsValid = true;
		} else {
			reasons.push('Location maps URLs missing for ceremony or reception.');
		}
	} else {
		reasons.push('Location content section missing ceremony or reception data.');
	}
}

export async function evaluateInvitationReadiness(options?: {
	slug?: string;
	projectRoot?: string;
}): Promise<ReadinessCheckResult> {
	const slug = options?.slug ?? 'romina-rios-chaparro';
	const reasons: string[] = [];

	const details: Details = {
		definitionFound: false,
		inventoryRowFound: false,
		isArchived: false,
		kind: null,
		hasProvenance: false,
		assetComplete: false,
		storageBinaryVerified: false,
		heroValid: false,
		mapsValid: false,
		noLocalPathLeak: false,
	};

	// 1. Definition check
	const definition = verifyDefinition(slug, reasons);
	if (!definition) return { slug, verdict: 'NO-GO', exitCode: 1, reasons, details };
	details.definitionFound = true;

	// 2. Resolve Local Environment
	let env;
	try {
		env = resolveLocalEnv(options?.projectRoot);
	} catch (err) {
		reasons.push(
			`Persistent-local environment unavailable: ${err instanceof Error ? err.message : String(err)}`,
		);
		return { slug, verdict: 'BLOCKED', exitCode: 2, reasons, details };
	}

	const supabase = createClient(env.apiUrl, env.serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	// 3. Persistent-local DB Inventory Row
	const inv = await verifyDbRow(supabase, slug, reasons, details);
	if (!inv) {
		const verdict = reasons.some((r) => r.includes('database')) ? 'BLOCKED' : 'NO-GO';
		return { slug, verdict, exitCode: verdict === 'BLOCKED' ? 2 : 1, reasons, details };
	}

	// 4. Managed Release Provenance
	const { data: provRows } = await supabase
		.from('managed_invitation_release_provenance')
		.select('invitation_id, applied_at, package_hash, projection_hash')
		.eq('invitation_id', inv.id);

	if (provRows && provRows.length > 0) {
		details.hasProvenance = true;
	} else {
		reasons.push(`Managed release provenance is missing for "${slug}" (UNAPPLIED_DEFINITION).`);
	}

	// 5. DB Assets & Storage Binary Verification
	await verifyDbAssets(supabase, inv.id, definition, reasons, details);

	// 6. Published Content Integrity & UI Checks
	const { data: pubData } = await supabase
		.from('published_invitation_content')
		.select('content')
		.eq('invitation_project_id', inv.id)
		.is('deleted_at', null)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();

	verifyPublishedContent(
		pubData?.content as Record<string, unknown> | undefined,
		reasons,
		details,
	);

	// Final Verdict Determination
	if (reasons.length === 0) {
		return { slug, verdict: 'READY', exitCode: 0, reasons, details };
	} else {
		return { slug, verdict: 'NO-GO', exitCode: 1, reasons, details };
	}
}

if (process.argv[1]?.endsWith('invitation-readiness.ts')) {
	evaluateInvitationReadiness()
		.then((result) => {
			console.log(JSON.stringify(result, null, 2));
			process.exitCode = result.exitCode;
		})
		.catch((err) => {
			console.error(err);
			process.exitCode = 2;
		});
}
