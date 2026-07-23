/** Idempotent Preview-only provenance baseline; it never changes invitation content or versions. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getSecretFromEnvOrFiles, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES } from '../db/db-target-config.ts';
import { validatePackageData, runImportEngine } from './invitation-import-engine.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import { verifyPreviewApprovalArtifact } from './preview-approval-service.ts';

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

export async function establishPreviewProvenanceBaseline(input: {
	packagePath: string;
	approvalArtifactPath: string;
	apply?: boolean;
}): Promise<{ status: 'PLANNED' | 'BASELINED' | 'IN_SYNC'; invitationId: string; writes: number }> {
	const pkg = readPackage(resolve(process.cwd(), input.packagePath));
	const approvalPath = resolve(process.cwd(), input.approvalArtifactPath);
	verifyPreviewApprovalArtifact(
		{
			packageHash: pkg.packageHash, sourceHash: pkg.sourceHash, metadataHash: pkg.metadataHash,
			projectionHash: pkg.projectionHash, assetManifestHash: pkg.assetManifestHash,
			slug: pkg.invitation.slug, route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}`,
		},
		[dirname(approvalPath)],
	);
	const dbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!dbUrl) throw new Error('Preview credentials are unavailable.');
	const verified = await runImportEngine({ packageData: pkg, target: 'preview', targetDbUrl: dbUrl, dryRun: true });
	if (!verified.isZeroDrift || Object.keys(verified.verifiedAssetHashes).length !== pkg.assets.length) {
		throw new Error('Preview is not synchronized with the approved release; provenance was not written.');
	}
	const activeCount = Number(
		runPsql(
			`select count(*) from public.invitations where slug = ${sqlLiteral(pkg.invitation.slug)} and archived_at is null and kind = 'client';`,
			dbUrl,
			{ tuplesOnly: true },
		).stdout.trim(),
	);
	if (activeCount !== 1) throw new Error('Preview provenance requires exactly one active client invitation.');
	const row = parseRow(runPsql(
		`select row_to_json(t) from (select i.id as "invitationId", p.source_hash, p.package_hash, p.metadata_hash, p.projection_hash, p.asset_manifest_hash from public.invitations i left join public.managed_invitation_release_provenance p on p.invitation_id = i.id where i.slug = ${sqlLiteral(pkg.invitation.slug)} and i.archived_at is null and i.kind = 'client') t;`,
		dbUrl,
		{ tuplesOnly: true },
	).stdout);
	if (!row?.invitationId || typeof row.invitationId !== 'string') throw new Error('Preview has no active client invitation for this approved release.');
	const expectedProjection = projectionProvenanceHash(pkg.projectionHash);
	if (row.package_hash) {
		if (
			row.source_hash !== pkg.sourceHash || row.package_hash !== pkg.packageHash ||
			row.metadata_hash !== pkg.metadataHash || row.projection_hash !== expectedProjection ||
			row.asset_manifest_hash !== pkg.assetManifestHash
		) throw new Error('Preview has conflicting managed provenance.');
		return { status: 'IN_SYNC', invitationId: row.invitationId, writes: 0 };
	}
	if (!input.apply) return { status: 'PLANNED', invitationId: row.invitationId, writes: 1 };
	runPsql(
		`insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, applied_at) values (${sqlLiteral(row.invitationId)}::uuid, ${sqlLiteral(pkg.sourceSlug)}, ${sqlLiteral(pkg.schemaVersion)}, ${sqlLiteral(pkg.sourceHash)}, ${sqlLiteral(pkg.packageHash)}, ${sqlLiteral(pkg.metadataHash)}, ${sqlLiteral(expectedProjection)}, ${sqlLiteral(pkg.assetManifestHash)}, now()) on conflict (invitation_id) do nothing;`,
		dbUrl,
	);
	return { status: 'BASELINED', invitationId: row.invitationId, writes: 1 };
}
