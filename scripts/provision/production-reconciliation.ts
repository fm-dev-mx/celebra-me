/** Pure, deterministic domain contracts for one-time legacy Production adoption. */
import { createHash } from 'node:crypto';
import { canonicalize } from './normalized-invitation-release.ts';

const LEGACY_ADOPTION_SCHEMA_VERSION = '1.0.0';
const LEGACY_ADOPTION_OPERATION = 'legacy-production-adoption';
export const LEGACY_ADOPTION_SLUG = 'romina-rios-chaparro';

type ProductionDifferenceClassification =
	| 'canonical-replacement'
	| 'target-specific-materialization'
	| 'protected-data';

interface ProductionSemanticDifference {
	path: string;
	approvedValue: unknown;
	productionDraftValue: unknown;
	productionPublishedValue: unknown;
	classification: ProductionDifferenceClassification;
}

export interface AdoptionAssetMapping {
	semanticKey: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
	assetId: string;
	storagePath: string;
}

interface AdoptionPathDecision {
	path: string;
	decision: 'replace-with-approved' | 'preserve-target-materialization';
}

export interface LegacyAdoptionManifest {
	schemaVersion: typeof LEGACY_ADOPTION_SCHEMA_VERSION;
	operation: typeof LEGACY_ADOPTION_OPERATION;
	target: 'production';
	slug: typeof LEGACY_ADOPTION_SLUG;
	invitationId: string;
	approvedRelease: {
		sourceHash: string;
		packageHash: string;
		metadataHash: string;
		projectionHash: string;
		assetManifestHash: string;
	};
	expectedTarget: {
		draftId: string;
		draftUpdatedAt: string;
		draftHash: string;
		publishedVersion: number;
		publishedHash: string;
	};
	pathDecisions: AdoptionPathDecision[];
	assetMappings: AdoptionAssetMapping[];
	protectedPathPolicy: readonly string[];
	expectedOperations: {
		draftUpdates: 1;
		publishedUpdates: 1;
		provenanceInserts: 1;
		receiptInserts: 1;
		storageUploads: 0;
		storageOverwrites: 0;
		storageMoves: 0;
		storageDeletes: 0;
	};
	manifestHash: string;
}

export interface LegacyAdoptionPlan {
	manifestHash: string;
	planHash: string;
	adoptionIdentity: string;
	requestHash: string;
	materializedProjectionHash: string;
	differences: ProductionSemanticDifference[];
	materializedContent: Record<string, unknown>;
	storageMutations: { uploads: 0; overwrites: 0; moves: 0; deletes: 0 };
	databaseWrites: { draftUpdates: 1; publishedUpdates: 1; provenanceInserts: 1; receiptInserts: 1 };
}

const MISSING = Symbol('missing');
const SHA256 = /^[a-f0-9]{64}$/;
const MD5 = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROTECTED_ADOPTION_PATH_PREFIXES = Object.freeze([
	'content.invitation.',
	'content.events.',
	'content.guests.',
	'content.rsvps.',
	'content.analytics.',
	'content.claimCodes.',
	'content.intake.',
	'content.audit.',
]);

function sha256(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function sha256Text(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function md5(value: unknown): string {
	return createHash('md5').update(canonicalize(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function visible(value: unknown): unknown {
	return value === MISSING ? null : value;
}

function isProtectedPath(path: string): boolean {
	return PROTECTED_ADOPTION_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isMaterializedAssetPath(path: string): boolean {
	return /\.(assetId|src)$/.test(path);
}

function classify(
	path: string,
	approved: unknown,
	draft: unknown,
	published: unknown,
): ProductionDifferenceClassification {
	if (isProtectedPath(path)) return 'protected-data';
	if (
		isMaterializedAssetPath(path) &&
		approved !== MISSING &&
		approved !== null &&
		draft !== MISSING &&
		published !== MISSING
	) {
		return 'target-specific-materialization';
	}
	return 'canonical-replacement';
}

function compare(
	path: string,
	approved: unknown,
	draft: unknown,
	published: unknown,
	output: ProductionSemanticDifference[],
): void {
	if (canonicalize(approved) === canonicalize(draft) && canonicalize(approved) === canonicalize(published)) return;
	if (isRecord(approved) || isRecord(draft) || isRecord(published)) {
		const records = [approved, draft, published].map((value) =>
			isRecord(value) ? value : {},
		);
		for (const key of [...new Set(records.flatMap(Object.keys))].sort()) {
			compare(
				`${path}.${key}`,
				records[0][key] ?? MISSING,
				records[1][key] ?? MISSING,
				records[2][key] ?? MISSING,
				output,
			);
		}
		return;
	}
	output.push({
		path,
		approvedValue: visible(approved),
		productionDraftValue: visible(draft),
		productionPublishedValue: visible(published),
		classification: classify(path, approved, draft, published),
	});
}

/** A stable path-level diff; it never infers authorization from an approval artifact. */
export function buildProductionSemanticDiff(
	approvedContent: Record<string, unknown>,
	productionDraft: Record<string, unknown>,
	productionPublished: Record<string, unknown>,
): ProductionSemanticDifference[] {
	const differences: ProductionSemanticDifference[] = [];
	compare('content', approvedContent, productionDraft, productionPublished, differences);
	return differences;
}

function assertHash(label: string, value: string, pattern = SHA256): void {
	if (!pattern.test(value)) throw new Error(`Legacy adoption manifest has an invalid ${label}.`);
}

function assertUnique<T>(label: string, values: T[]): void {
	if (new Set(values).size !== values.length) throw new Error(`Legacy adoption manifest has duplicate ${label}.`);
}

function manifestPayload(manifest: Omit<LegacyAdoptionManifest, 'manifestHash'>): Omit<LegacyAdoptionManifest, 'manifestHash'> {
	return {
		...manifest,
		pathDecisions: [...manifest.pathDecisions].sort((a, b) => a.path.localeCompare(b.path)),
		assetMappings: [...manifest.assetMappings].sort((a, b) => a.semanticKey.localeCompare(b.semanticKey)),
		protectedPathPolicy: [...manifest.protectedPathPolicy].sort(),
	};
}

function computeLegacyAdoptionManifestHash(
	manifest: Omit<LegacyAdoptionManifest, 'manifestHash'>,
): string {
	return sha256(manifestPayload(manifest));
}

// eslint-disable-next-line complexity -- Every manifest field is an independent fail-closed safety gate.
export function validateLegacyAdoptionManifest(manifest: LegacyAdoptionManifest): LegacyAdoptionManifest {
	if (
		manifest.schemaVersion !== LEGACY_ADOPTION_SCHEMA_VERSION ||
		manifest.operation !== LEGACY_ADOPTION_OPERATION ||
		manifest.target !== 'production' ||
		manifest.slug !== LEGACY_ADOPTION_SLUG ||
		!UUID.test(manifest.invitationId)
	) {
		throw new Error('Legacy adoption manifest has an invalid immutable target identity.');
	}
	for (const [name, value] of Object.entries(manifest.approvedRelease)) {
		assertHash(name, value, name === 'projectionHash' ? MD5 : SHA256);
	}
	if (!UUID.test(manifest.expectedTarget.draftId) || !Number.isInteger(manifest.expectedTarget.publishedVersion)) {
		throw new Error('Legacy adoption manifest has invalid target expectations.');
	}
	assertHash('draftHash', manifest.expectedTarget.draftHash, MD5);
	assertHash('publishedHash', manifest.expectedTarget.publishedHash, MD5);
	if (!Number.isFinite(Date.parse(manifest.expectedTarget.draftUpdatedAt))) {
		throw new Error('Legacy adoption manifest has an invalid draft timestamp.');
	}
	assertUnique('path decisions', manifest.pathDecisions.map((decision) => decision.path));
	if (manifest.pathDecisions.length === 0) throw new Error('Legacy adoption manifest has no semantic decisions.');
	for (const decision of manifest.pathDecisions) {
		if (!decision.path.startsWith('content.') || isProtectedPath(decision.path)) {
			throw new Error(`Legacy adoption manifest authorizes an unknown or protected path: ${decision.path}.`);
		}
		if (!['replace-with-approved', 'preserve-target-materialization'].includes(decision.decision)) {
			throw new Error(`Legacy adoption manifest has an invalid decision for ${decision.path}.`);
		}
	}
	assertUnique('semantic asset keys', manifest.assetMappings.map((mapping) => mapping.semanticKey));
	assertUnique('asset IDs', manifest.assetMappings.map((mapping) => mapping.assetId));
	if (manifest.assetMappings.length !== 11) {
		throw new Error('Legacy adoption manifest must map exactly eleven existing Production assets.');
	}
	for (const mapping of manifest.assetMappings) {
		if (!mapping.semanticKey || !UUID.test(mapping.assetId) || !mapping.storagePath || mapping.width <= 0 || mapping.height <= 0) {
			throw new Error(`Legacy adoption manifest has invalid asset mapping for ${mapping.semanticKey}.`);
		}
		assertHash(`asset SHA-256 for ${mapping.semanticKey}`, mapping.sha256);
		if (!mapping.mimeType.startsWith('image/')) throw new Error(`Legacy adoption manifest has invalid MIME for ${mapping.semanticKey}.`);
	}
	if (
		canonicalize([...manifest.protectedPathPolicy].sort()) !== canonicalize([...PROTECTED_ADOPTION_PATH_PREFIXES].sort()) ||
		canonicalize(manifest.expectedOperations) !==
			canonicalize({ draftUpdates: 1, publishedUpdates: 1, provenanceInserts: 1, receiptInserts: 1, storageUploads: 0, storageOverwrites: 0, storageMoves: 0, storageDeletes: 0 })
	) {
		throw new Error('Legacy adoption manifest does not preserve the protected-data or zero-Storage contract.');
	}
	const { manifestHash: _manifestHash, ...unsignedManifest } = manifest;
	const expectedHash = computeLegacyAdoptionManifestHash(unsignedManifest);
	if (manifest.manifestHash !== expectedHash) throw new Error('Legacy adoption manifest hash mismatch.');
	return manifest;
}

export function createLegacyAdoptionManifest(
	input: Omit<LegacyAdoptionManifest, 'manifestHash'>,
): LegacyAdoptionManifest {
	const payload = manifestPayload(input);
	return validateLegacyAdoptionManifest({ ...payload, manifestHash: computeLegacyAdoptionManifestHash(payload) });
}

export function buildLegacyAdoptionPlan(input: {
	manifest: LegacyAdoptionManifest;
	approvedContent: Record<string, unknown>;
	productionDraft: Record<string, unknown>;
	productionPublished: Record<string, unknown>;
	materializedContent: Record<string, unknown>;
}): LegacyAdoptionPlan {
	const manifest = validateLegacyAdoptionManifest(input.manifest);
	const differences = buildProductionSemanticDiff(
		input.approvedContent,
		input.productionDraft,
		input.productionPublished,
	);
	const decisions = new Map(manifest.pathDecisions.map((decision) => [decision.path, decision]));
	for (const difference of differences) {
		const decision = decisions.get(difference.path);
		if (!decision || difference.classification === 'protected-data') {
			throw new Error(`Legacy adoption plan has an unapproved or protected difference at ${difference.path}.`);
		}
		if (
			(difference.classification === 'target-specific-materialization') !==
			(decision.decision === 'preserve-target-materialization')
		) {
			throw new Error(`Legacy adoption decision type does not match ${difference.path}.`);
		}
	}
	for (const decision of manifest.pathDecisions) {
		if (!differences.some((difference) => difference.path === decision.path)) {
			throw new Error(`Legacy adoption manifest contains a stale decision for ${decision.path}.`);
		}
	}
	const materializedProjectionHash = md5(input.materializedContent);
	const adoptionIdentity = sha256Text(
		`${manifest.invitationId}\u001f${LEGACY_ADOPTION_OPERATION}\u001f${manifest.approvedRelease.packageHash}\u001f${manifest.manifestHash}`,
	);
	const requestHash = sha256({
		manifestHash: manifest.manifestHash,
		adoptionIdentity,
		materializedProjectionHash,
		content: input.materializedContent,
	});
	const planHash = sha256({ manifestHash: manifest.manifestHash, differences, materializedProjectionHash, adoptionIdentity, requestHash });
	return {
		manifestHash: manifest.manifestHash,
		planHash,
		adoptionIdentity,
		requestHash,
		materializedProjectionHash,
		differences,
		materializedContent: input.materializedContent,
		storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		databaseWrites: { draftUpdates: 1, publishedUpdates: 1, provenanceInserts: 1, receiptInserts: 1 },
	};
}
