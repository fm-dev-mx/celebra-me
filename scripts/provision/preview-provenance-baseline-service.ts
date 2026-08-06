/** Idempotent Preview-only provenance baseline; it never changes invitation content or versions. */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getSecretFromEnvOrFiles, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES } from '../db/db-target-config.ts';
import { validatePackageData, runImportEngine } from './invitation-import-engine.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import { verifyPreviewApprovalArtifact } from './preview-approval-service.ts';
import { ManagedBaselineError } from './managed-merge-baseline.ts';

interface PreviewRow {
	invitationId: string;
	draftUpdatedAt?: string;
	draftContent?: Record<string, unknown>;
	publishedVersion?: number;
	publishedContent?: Record<string, unknown>;
	source_hash?: string;
	package_hash?: string;
	metadata_hash?: string;
	projection_hash?: string;
	asset_manifest_hash?: string;
	managed_projection?: unknown;
	applied_operation_id?: string;
}

function readPackage(path: string): InvitationPackageData {
	return validatePackageData(JSON.parse(readFileSync(path, 'utf8')) as InvitationPackageData);
}

function parseRow(stdout: string): Record<string, unknown> | null {
	const trimmed = stdout.trim();
	if (!trimmed || trimmed === 'null') return null;
	const start = trimmed.indexOf('{');
	const end = trimmed.lastIndexOf('}');
	return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function projectionProvenanceHash(projectionHash: string): string {
	return createHash('sha256').update(projectionHash).digest('hex');
}

function publicationHash(content: Record<string, unknown>): string {
	return createHash('md5').update(JSON.stringify(content)).digest('hex');
}

function verifyApprovalForApply(
	input: { approvalArtifactPath?: string; apply?: boolean },
	pkg: InvitationPackageData,
): void {
	if (!input.apply) return;
	const identity = {
		packageHash: pkg.packageHash,
		sourceHash: pkg.sourceHash,
		metadataHash: pkg.metadataHash,
		projectionHash: pkg.projectionHash,
		assetManifestHash: pkg.assetManifestHash,
		slug: pkg.invitation.slug,
		route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}`,
	};
	// Prefer shared Preview DB store; optional legacy file dir remains as fallback.
	if (input.approvalArtifactPath) {
		const approvalPath = resolve(process.cwd(), input.approvalArtifactPath);
		verifyPreviewApprovalArtifact(identity, [dirname(approvalPath)]);
		return;
	}
	verifyPreviewApprovalArtifact(identity);
}

async function verifyPreviewTarget(
	pkg: InvitationPackageData,
	dbUrl: string,
): Promise<{ unavailable: true } | { unavailable: false }> {
	try {
		const verified = await runImportEngine({
			packageData: pkg,
			target: 'preview',
			targetDbUrl: dbUrl,
			dryRun: true,
		});
		if (
			!verified.isZeroDrift ||
			Object.keys(verified.verifiedAssetHashes).length !== pkg.assets.length
		)
			throw new Error(
				'Preview is not synchronized with the approved release; provenance was not written.',
			);
		return { unavailable: false };
	} catch (error) {
		if (error instanceof ManagedBaselineError) return { unavailable: true };
		throw error;
	}
}

function loadPreviewRow(pkg: InvitationPackageData, dbUrl: string): PreviewRow {
	const activeCount = Number(
		runPsql(
			`select count(*) from public.invitations where slug = ${sqlLiteral(pkg.invitation.slug)} and archived_at is null and kind = 'client';`,
			dbUrl,
			{ tuplesOnly: true },
		).stdout.trim(),
	);
	if (activeCount !== 1)
		throw new Error('Preview provenance requires exactly one active client invitation.');
	const row = parseRow(
		runPsql(
			`select row_to_json(t) from (select i.id as "invitationId", d.updated_at as "draftUpdatedAt", d.content as "draftContent", pub.version as "publishedVersion", pub.content as "publishedContent", p.source_hash, p.package_hash, p.metadata_hash, p.projection_hash, p.asset_manifest_hash, p.managed_projection, p.applied_operation_id from public.invitations i join lateral (select updated_at, content from public.invitation_content_drafts where invitation_project_id = i.id and deleted_at is null order by updated_at desc limit 1) d on true join lateral (select version, content from public.published_invitation_content where invitation_project_id = i.id and deleted_at is null order by version desc limit 1) pub on true left join public.managed_invitation_release_provenance p on p.invitation_id = i.id where i.slug = ${sqlLiteral(pkg.invitation.slug)} and i.archived_at is null and i.kind = 'client') t;`,
			dbUrl,
			{ tuplesOnly: true },
		).stdout,
	);
	if (!row?.invitationId || typeof row.invitationId !== 'string')
		throw new Error('Preview has no active client invitation for this approved release.');
	return row as unknown as PreviewRow;
}

function hasMatchingProvenance(
	row: PreviewRow,
	pkg: InvitationPackageData,
	expectedProjection: string,
): boolean {
	if (!row.package_hash || !row.managed_projection || !row.applied_operation_id) return false;
	if (
		row.source_hash !== pkg.sourceHash ||
		row.package_hash !== pkg.packageHash ||
		row.metadata_hash !== pkg.metadataHash ||
		row.projection_hash !== expectedProjection ||
		row.asset_manifest_hash !== pkg.assetManifestHash
	)
		throw new Error('Preview has conflicting managed provenance.');
	return true;
}

function assertReconstructableRow(row: PreviewRow): asserts row is PreviewRow & {
	draftUpdatedAt: string;
	draftContent: Record<string, unknown>;
	publishedContent: Record<string, unknown>;
	publishedVersion: number;
} {
	if (
		typeof row.draftUpdatedAt !== 'string' ||
		!row.draftContent ||
		!row.publishedContent ||
		typeof row.publishedVersion !== 'number'
	)
		throw new Error(
			'Preview baseline reconstruction requires one current draft and published document.',
		);
}

function writeBaseline(
	row: PreviewRow & {
		draftUpdatedAt: string;
		draftContent: Record<string, unknown>;
		publishedContent: Record<string, unknown>;
		publishedVersion: number;
	},
	pkg: InvitationPackageData,
	expectedProjection: string,
	dbUrl: string,
): void {
	const operationId = randomUUID();
	const appliedPublishedProjectionHash = publicationHash(row.publishedContent);
	runPsql(
		`begin; insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, managed_projection, applied_draft_updated_at, applied_operation_id, applied_published_version, applied_published_projection_hash, applied_at) values (${sqlLiteral(row.invitationId)}::uuid, ${sqlLiteral(pkg.sourceSlug)}, ${sqlLiteral(pkg.schemaVersion)}, ${sqlLiteral(pkg.sourceHash)}, ${sqlLiteral(pkg.packageHash)}, ${sqlLiteral(pkg.metadataHash)}, ${sqlLiteral(expectedProjection)}, ${sqlLiteral(pkg.assetManifestHash)}, ${sqlLiteral(JSON.stringify(row.draftContent))}::jsonb, ${sqlLiteral(row.draftUpdatedAt)}::timestamptz, '${operationId}'::uuid, ${row.publishedVersion}, ${sqlLiteral(appliedPublishedProjectionHash)}, now()) on conflict (invitation_id) do update set definition_slug = excluded.definition_slug, release_schema_version = excluded.release_schema_version, source_hash = excluded.source_hash, package_hash = excluded.package_hash, metadata_hash = excluded.metadata_hash, projection_hash = excluded.projection_hash, asset_manifest_hash = excluded.asset_manifest_hash, managed_projection = excluded.managed_projection, applied_draft_updated_at = excluded.applied_draft_updated_at, applied_operation_id = excluded.applied_operation_id, applied_published_version = excluded.applied_published_version, applied_published_projection_hash = excluded.applied_published_projection_hash, applied_at = excluded.applied_at; insert into public.invitation_mutation_operation_receipts (operation_id, invitation_id, environment, project_ref, actor_type, origin, command_kind, input_hashes, expected_state, status, completed_steps, result) values ('${operationId}'::uuid, ${sqlLiteral(row.invitationId)}::uuid, 'preview', 'preview', 'operator', 'managed_cli_hosted', 'managed_baseline_reconstruction', ${sqlLiteral(JSON.stringify({ sourceHash: pkg.sourceHash, packageHash: pkg.packageHash }))}::jsonb, ${sqlLiteral(JSON.stringify({ draftUpdatedAt: row.draftUpdatedAt, publishedVersion: row.publishedVersion }))}::jsonb, 'applied', array['target_verified', 'provenance_recorded'], '{}'::jsonb); commit;`,
		dbUrl,
	);
}

export async function establishPreviewProvenanceBaseline(input: {
	packagePath: string;
	approvalArtifactPath?: string;
	apply?: boolean;
}): Promise<{
	status: 'PLANNED' | 'BASELINED' | 'IN_SYNC' | 'EVIDENCE_UNAVAILABLE';
	invitationId: string | null;
	writes: number;
	evidence: 'package_and_target_parity' | 'legacy_provenance';
	uncertainty?: string;
}> {
	const pkg = readPackage(resolve(process.cwd(), input.packagePath));
	verifyApprovalForApply(input, pkg);
	const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!dbUrl) throw new Error('Preview credentials are unavailable.');
	const verification = await verifyPreviewTarget(pkg, dbUrl);
	if (verification.unavailable)
		return {
			status: 'EVIDENCE_UNAVAILABLE',
			invitationId: null,
			writes: 0,
			evidence: 'legacy_provenance',
			uncertainty:
				'La procedencia previa no permite reconstruir una comparación determinista del destino.',
		};
	const row = loadPreviewRow(pkg, dbUrl);
	const expectedProjection = projectionProvenanceHash(pkg.projectionHash);
	if (hasMatchingProvenance(row, pkg, expectedProjection)) {
		return {
			status: 'IN_SYNC',
			invitationId: row.invitationId,
			writes: 0,
			evidence: 'package_and_target_parity',
		};
	}
	assertReconstructableRow(row);
	if (!input.apply)
		return {
			status: 'PLANNED',
			invitationId: row.invitationId,
			writes: 2,
			evidence: 'package_and_target_parity',
		};
	writeBaseline(row, pkg, expectedProjection, dbUrl);
	return {
		status: 'BASELINED',
		invitationId: row.invitationId,
		writes: 2,
		evidence: 'package_and_target_parity',
	};
}
