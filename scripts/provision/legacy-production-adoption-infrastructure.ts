/** Production persistence adapter for the isolated legacy-adoption service. */
import { createHash } from 'node:crypto';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { buildStorageUrl, deriveSupabaseUrlFromDbUrl } from '../db/preview-sync-guards.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import type { AdoptionAssetMapping } from './production-reconciliation.ts';

export interface ProductionAdoptionState {
	invitation: Record<string, unknown>;
	draft: Record<string, unknown>;
	published: Record<string, unknown>;
	event: Record<string, unknown>;
	assets: Array<Record<string, unknown>>;
	provenance: Record<string, unknown> | null;
}

function parseJson(stdout: string): Record<string, unknown> {
	const start = stdout.indexOf('{');
	const end = stdout.lastIndexOf('}');
	if (start < 0 || end < start) throw new Error('Production adoption query returned no JSON state.');
	return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
}

export function loadProductionAdoptionState(dbUrl: string, slug: string): ProductionAdoptionState {
	const sql = `
select jsonb_build_object(
  'invitation', (select to_jsonb(i) from public.invitations i where i.slug = ${sqlLiteral(slug)} and i.archived_at is null order by i.id limit 1),
  'draft', (select to_jsonb(d) from public.invitation_content_drafts d join public.invitations i on i.id = d.invitation_project_id where i.slug = ${sqlLiteral(slug)} and i.archived_at is null and d.deleted_at is null order by d.updated_at desc limit 1),
  'published', (select to_jsonb(p) from public.published_invitation_content p join public.invitations i on i.id = p.invitation_project_id where i.slug = ${sqlLiteral(slug)} and i.archived_at is null and p.deleted_at is null order by p.version desc, p.created_at desc limit 1),
  'event', (select to_jsonb(e) from public.events e join public.invitations i on i.id = e.invitation_project_id where i.slug = ${sqlLiteral(slug)} and i.archived_at is null and e.deleted_at is null order by e.id limit 1),
  'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.invitation_assets a join public.invitations i on i.id = a.invitation_id where i.slug = ${sqlLiteral(slug)} and i.archived_at is null and a.deleted_at is null), '[]'::jsonb),
  'provenance', (select to_jsonb(pr) from public.managed_invitation_release_provenance pr join public.invitations i on i.id = pr.invitation_id where i.slug = ${sqlLiteral(slug)} and i.archived_at is null)
);`;
	const state = parseJson(runPsql(sql, dbUrl, { tuplesOnly: true }).stdout);
	if (!state.invitation || !state.draft || !state.published || !state.event) {
		throw new Error(`Production adoption requires exactly one complete active target state for "${slug}".`);
	}
	return {
		invitation: state.invitation as Record<string, unknown>,
		draft: state.draft as Record<string, unknown>,
		published: state.published as Record<string, unknown>,
		event: state.event as Record<string, unknown>,
		assets: state.assets as Array<Record<string, unknown>>,
		provenance: (state.provenance as Record<string, unknown> | null) ?? null,
	};
}

export function computeProductionJsonbMd5(dbUrl: string, content: Record<string, unknown>): string {
	const result = runPsql(
		`select md5(${sqlLiteral(JSON.stringify(content))}::jsonb::text);`,
		dbUrl,
		{ tuplesOnly: true },
	).stdout.trim();
	if (!/^[a-f0-9]{32}$/.test(result)) throw new Error('Production did not return a valid JSONB content hash.');
	return result;
}

export async function verifyProductionAssetMappings(input: {
	dbUrl: string;
	assets: InvitationPackageData['assets'];
	stateAssets: Array<Record<string, unknown>>;
}): Promise<AdoptionAssetMapping[]> {
	if (input.assets.length !== 11 || input.stateAssets.length !== 11) {
		throw new Error('Legacy adoption requires exactly eleven approved and existing Production assets.');
	}
	const storageUrl = buildStorageUrl(deriveSupabaseUrlFromDbUrl(input.dbUrl));
	const unmatched = [...input.stateAssets];
	const mappings: AdoptionAssetMapping[] = [];
	for (const asset of [...input.assets].sort((a, b) => a.key.localeCompare(b.key))) {
		const candidates = unmatched.filter(
			(row) =>
				row.display_name === asset.displayName &&
				row.mime_type === asset.mimeType &&
				Number(row.width) === asset.width &&
				Number(row.height) === asset.height &&
				Number(row.file_size) === asset.fileSize,
		);
		if (candidates.length !== 1) {
			throw new Error(`Production asset mapping is missing or ambiguous for semantic key "${asset.key}".`);
		}
		const row = candidates[0];
		const response = await fetch(`${storageUrl}/${String(row.storage_path)}`);
		if (!response.ok) throw new Error(`Production asset binary cannot be verified for "${asset.key}".`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		const hash = createHash('sha256').update(bytes).digest('hex');
		if (hash !== asset.sha256) throw new Error(`Production asset SHA-256 mismatch for "${asset.key}".`);
		mappings.push({
			semanticKey: asset.key,
			sha256: hash,
			mimeType: String(row.mime_type),
			width: Number(row.width),
			height: Number(row.height),
			assetId: String(row.id),
			storagePath: String(row.storage_path),
		});
		unmatched.splice(unmatched.indexOf(row), 1);
	}
	if (unmatched.length !== 0) throw new Error('Production contains unverified extra asset rows for this adoption.');
	return mappings;
}

export function executeProductionLegacyAdoption(input: {
	dbUrl: string;
	slug: string;
	invitationId: string;
	ownerUserId: string;
	draftId: string;
	draftUpdatedAt: string;
	expectedPublishedVersion: number;
	expectedDraftHash: string;
	expectedPublishedHash: string;
	sourceHash: string;
	packageHash: string;
	metadataHash: string;
	releaseProjectionHash: string;
	provenanceProjectionHash: string;
	assetManifestHash: string;
	manifestHash: string;
	adoptionIdentity: string;
	requestHash: string;
	materializedContentHash: string;
	content: Record<string, unknown>;
}): Record<string, unknown> {
	const args = [
		sqlLiteral(input.slug),
		`${sqlLiteral(input.invitationId)}::uuid`,
		`${sqlLiteral(input.ownerUserId)}::uuid`,
		`${sqlLiteral(input.draftId)}::uuid`,
		`${sqlLiteral(input.draftUpdatedAt)}::timestamptz`,
		String(input.expectedPublishedVersion),
		sqlLiteral(input.expectedDraftHash), sqlLiteral(input.expectedPublishedHash),
		sqlLiteral(input.sourceHash), sqlLiteral(input.packageHash), sqlLiteral(input.metadataHash),
		sqlLiteral(input.releaseProjectionHash), sqlLiteral(input.provenanceProjectionHash),
		sqlLiteral(input.assetManifestHash), sqlLiteral(input.manifestHash), sqlLiteral(input.adoptionIdentity),
		sqlLiteral(input.requestHash), sqlLiteral(input.materializedContentHash),
		`${sqlLiteral(JSON.stringify(input.content))}::jsonb`,
	].join(', ');
	const result = parseJson(
		runPsql(`select public.adopt_managed_invitation_legacy_atomic(${args});`, input.dbUrl, {
			tuplesOnly: true,
		}).stdout,
	);
	if (!result || typeof result !== 'object' || Array.isArray(result)) {
		throw new Error('Production legacy adoption RPC returned an invalid result.');
	}
	return result as Record<string, unknown>;
}
