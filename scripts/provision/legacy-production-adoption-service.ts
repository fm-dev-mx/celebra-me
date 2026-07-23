/** Application service for the explicit, one-time Production legacy adoption. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import { buildStorageUrl, deriveSupabaseUrlFromDbUrl } from '../db/preview-sync-guards.ts';
import { validatePackageData } from './invitation-import-engine.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import { canonicalize, materializeAssetReferences } from './normalized-invitation-release.ts';
import { verifyPreviewApprovalArtifact } from './preview-approval-service.ts';
import {
	buildLegacyAdoptionPlan,
	buildProductionSemanticDiff,
	createLegacyAdoptionManifest,
	LEGACY_ADOPTION_SLUG,
	type LegacyAdoptionManifest,
	type LegacyAdoptionPlan,
	validateLegacyAdoptionManifest,
} from './production-reconciliation.ts';
import {
	computeProductionJsonbMd5,
	executeProductionLegacyAdoption,
	loadProductionAdoptionState,
	verifyProductionAssetMappings,
} from './legacy-production-adoption-infrastructure.ts';

export interface ProductionLegacyAdoptionResult {
	status: 'PLANNED' | 'ADOPTED' | 'IN_SYNC';
	manifestPath: string;
	manifestHash: string;
	planHash: string;
	packageHash: string;
	ownerUserId: string;
	publishedVersion: number;
	semanticDiff: LegacyAdoptionPlan['differences'];
	databaseWrites: Record<string, number>;
	storageMutations: { uploads: 0; overwrites: 0; moves: 0; deletes: 0 };
	rpcResult?: Record<string, unknown>;
}

function readJson<T>(path: string): T {
	if (!existsSync(path)) throw new Error(`Required adoption artifact does not exist: ${path}.`);
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function packageFromPath(path: string): InvitationPackageData {
	return validatePackageData(readJson<InvitationPackageData>(path));
}

function manifestPathFor(packageHash: string): string {
	return resolve(
		process.cwd(),
		'.agent/tmp/adoptions',
		`romina-rios-chaparro-${packageHash.slice(0, 16)}.json`,
	);
}

function writeManifest(path: string, manifest: LegacyAdoptionManifest): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function materializeApprovedContent(
	pkg: InvitationPackageData,
	mappings: LegacyAdoptionManifest['assetMappings'],
	dbUrl: string,
): Record<string, unknown> {
	const storageUrl = buildStorageUrl(deriveSupabaseUrlFromDbUrl(dbUrl));
	const assetMap = Object.fromEntries(
		mappings.map((mapping) => [
			mapping.semanticKey,
			{
				type: 'uploaded' as const,
				assetId: mapping.assetId,
				src: `${storageUrl}/${mapping.storagePath}`,
			},
		]),
	);
	return materializeAssetReferences(pkg.publishedContent.content, assetMap) as Record<string, unknown>;
}

function isApprovedManagedProvenance(
	provenance: Record<string, unknown> | null,
	pkg: InvitationPackageData,
	manifestHash: string,
): boolean {
	return Boolean(
		provenance &&
			provenance.package_hash === pkg.packageHash &&
			provenance.source_hash === pkg.sourceHash &&
			provenance.metadata_hash === pkg.metadataHash &&
			provenance.asset_manifest_hash === pkg.assetManifestHash &&
			provenance.adoption_manifest_hash === manifestHash,
	);
}

function provenanceProjectionHash(projectionHash: string): string {
	return createHash('sha256').update(projectionHash).digest('hex');
}

export async function runProductionLegacyAdoption(input: {
	packagePath: string;
	approvalArtifactPath: string;
	manifestPath?: string;
	apply?: boolean;
}): Promise<ProductionLegacyAdoptionResult> {
	const pkg = packageFromPath(resolve(process.cwd(), input.packagePath));
	if (pkg.invitation.slug !== LEGACY_ADOPTION_SLUG) throw new Error(`Legacy adoption is restricted to ${LEGACY_ADOPTION_SLUG}.`);
	const approvalPath = resolve(process.cwd(), input.approvalArtifactPath);
	const artifact = verifyPreviewApprovalArtifact(
		{
			packageHash: pkg.packageHash,
			sourceHash: pkg.sourceHash,
			metadataHash: pkg.metadataHash,
			projectionHash: pkg.projectionHash,
			assetManifestHash: pkg.assetManifestHash,
			slug: pkg.invitation.slug,
			route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}`,
		},
		[dirname(approvalPath)],
	);
	if (resolve(dirname(approvalPath), `preview-approval-${pkg.packageHash.slice(0, 16)}.json`) !== approvalPath || artifact.slug !== pkg.invitation.slug) {
		throw new Error('The exact approved Preview artifact path is required for legacy adoption.');
	}
	const { url: dbUrl } = getProdDbUrl();
	const state = loadProductionAdoptionState(dbUrl, pkg.invitation.slug);
	if (
		state.invitation.kind !== 'client' ||
		typeof state.invitation.created_by !== 'string' ||
		state.event.owner_user_id !== state.invitation.created_by
	) {
		throw new Error('Production adoption owner or client-invitation validation failed.');
	}
	const manifestPath = resolve(process.cwd(), input.manifestPath ?? manifestPathFor(pkg.packageHash));
	const verifiedMappings = await verifyProductionAssetMappings({
		dbUrl,
		assets: pkg.assets,
		stateAssets: state.assets,
	});
	let manifest: LegacyAdoptionManifest;
	if (existsSync(manifestPath)) {
		manifest = validateLegacyAdoptionManifest(readJson<LegacyAdoptionManifest>(manifestPath));
		if (canonicalize(manifest.assetMappings) !== canonicalize(verifiedMappings)) {
			throw new Error('Production asset mappings changed after the adoption manifest was generated.');
		}
	} else {
		const approvedContent = pkg.publishedContent.content;
		const differences = buildProductionSemanticDiff(
			approvedContent,
			state.draft.content as Record<string, unknown>,
			state.published.content as Record<string, unknown>,
		);
		manifest = createLegacyAdoptionManifest({
			schemaVersion: '1.0.0',
			operation: 'legacy-production-adoption',
			target: 'production',
			slug: LEGACY_ADOPTION_SLUG,
			invitationId: String(state.invitation.id),
			approvedRelease: {
				sourceHash: pkg.sourceHash,
				packageHash: pkg.packageHash,
				metadataHash: pkg.metadataHash,
				projectionHash: pkg.projectionHash,
				assetManifestHash: pkg.assetManifestHash,
			},
			expectedTarget: {
				draftId: String(state.draft.id),
				draftUpdatedAt: String(state.draft.updated_at),
				draftHash: computeProductionJsonbMd5(dbUrl, state.draft.content as Record<string, unknown>),
				publishedVersion: Number(state.published.version),
				publishedHash: computeProductionJsonbMd5(dbUrl, state.published.content as Record<string, unknown>),
			},
			pathDecisions: differences.map((difference) => ({
				path: difference.path,
				decision:
					difference.classification === 'target-specific-materialization'
						? 'preserve-target-materialization'
						: 'replace-with-approved',
			})),
			assetMappings: verifiedMappings,
			protectedPathPolicy: [
				'content.invitation.', 'content.events.', 'content.guests.', 'content.rsvps.',
				'content.analytics.', 'content.claimCodes.', 'content.intake.', 'content.audit.',
			],
			expectedOperations: {
				draftUpdates: 1, publishedUpdates: 1, provenanceInserts: 1, receiptInserts: 1,
				storageUploads: 0, storageOverwrites: 0, storageMoves: 0, storageDeletes: 0,
			},
		});
		writeManifest(manifestPath, manifest);
	}
	const materializedContent = materializeApprovedContent(pkg, manifest.assetMappings, dbUrl);
	const materializedContentHash = computeProductionJsonbMd5(dbUrl, materializedContent);
	const inSync = isApprovedManagedProvenance(state.provenance, pkg, manifest.manifestHash) &&
		computeProductionJsonbMd5(dbUrl, state.draft.content as Record<string, unknown>) === materializedContentHash &&
		computeProductionJsonbMd5(dbUrl, state.published.content as Record<string, unknown>) === materializedContentHash;
	if (inSync) {
		const noOpPlanHash = createHash('sha256')
			.update(canonicalize({ manifestHash: manifest.manifestHash, materializedContentHash, status: 'IN_SYNC' }))
			.digest('hex');
		return {
			status: 'IN_SYNC', manifestPath, manifestHash: manifest.manifestHash, planHash: noOpPlanHash,
			packageHash: pkg.packageHash, ownerUserId: String(state.invitation.created_by),
			publishedVersion: Number(state.published.version), semanticDiff: [], databaseWrites: {},
			storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		};
	}
	const plan = buildLegacyAdoptionPlan({
		manifest,
		approvedContent: pkg.publishedContent.content,
		productionDraft: state.draft.content as Record<string, unknown>,
		productionPublished: state.published.content as Record<string, unknown>,
		materializedContent,
	});
	if (!input.apply) {
		return {
			status: 'PLANNED', manifestPath, manifestHash: manifest.manifestHash, planHash: plan.planHash,
			packageHash: pkg.packageHash, ownerUserId: String(state.invitation.created_by),
			publishedVersion: Number(state.published.version) + 1, semanticDiff: plan.differences,
			databaseWrites: plan.databaseWrites, storageMutations: plan.storageMutations,
		};
	}
	const rpcResult = executeProductionLegacyAdoption({
		dbUrl, slug: pkg.invitation.slug, invitationId: String(state.invitation.id),
		ownerUserId: String(state.invitation.created_by), draftId: String(state.draft.id),
		draftUpdatedAt: String(state.draft.updated_at), expectedPublishedVersion: Number(state.published.version),
		expectedDraftHash: manifest.expectedTarget.draftHash, expectedPublishedHash: manifest.expectedTarget.publishedHash,
		sourceHash: pkg.sourceHash, packageHash: pkg.packageHash, metadataHash: pkg.metadataHash,
		releaseProjectionHash: pkg.projectionHash, provenanceProjectionHash: provenanceProjectionHash(pkg.projectionHash),
		assetManifestHash: pkg.assetManifestHash, manifestHash: manifest.manifestHash,
		adoptionIdentity: plan.adoptionIdentity, requestHash: plan.requestHash,
		materializedContentHash, content: materializedContent,
	});
	return {
		status: rpcResult.idempotent === true ? 'IN_SYNC' : 'ADOPTED', manifestPath,
		manifestHash: manifest.manifestHash, planHash: plan.planHash, packageHash: pkg.packageHash,
		ownerUserId: String(state.invitation.created_by), publishedVersion: Number(rpcResult.publishedVersion),
		semanticDiff: plan.differences, databaseWrites: rpcResult.idempotent === true ? {} : plan.databaseWrites,
		storageMutations: plan.storageMutations, rpcResult,
	};
}
