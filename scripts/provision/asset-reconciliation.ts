import type { InvitationPackageAsset } from './invitation-package.ts';

export type AssetClassification =
	| 'MATCH'
	| 'BINARY_MATCH_METADATA_DRIFT'
	| 'MISSING'
	| 'CONTENT_MISMATCH'
	| 'INVALID'
	| 'UNREFERENCED';

export type PlannedAssetAction =
	| 'REUSE'
	| 'REPAIR_METADATA'
	| 'UPLOAD'
	| 'OVERWRITE'
	| 'RETAIN'
	| 'PRUNE'
	| 'BLOCK';

export type AssetPolicy = 'verify' | 'missing' | 'sync';

export interface TargetAssetRecord {
	id: string;
	displayName: string;
	storagePath: string;
	bucket: string;
	mimeType: string;
	fileSize: number | null;
	width: number | null;
	height: number | null;
	validationVersion: number;
	originalMimeType?: string | null;
	originalFileSize?: number | null;
	altText?: string | null;
}

export interface ObservedStorageState {
	present: boolean;
	sha256: string | null;
	httpStatus?: number;
}

export interface ReconciledAsset {
	key: string;
	displayName: string;
	canonicalHash: string;
	canonicalSize: number | null;
	canonicalMimeType: string;
	targetStoragePath: string;
	targetAssetId?: string;
	classification: AssetClassification;
	plannedAction: PlannedAssetAction;
	reasonCode: string;
	reason: string;
	observedHash: string | null;
	observedSize: number | null;
}

export interface AssetReconciliationSummary {
	totalCanonical: number;
	match: number;
	metadataDrift: number;
	missing: number;
	contentMismatch: number;
	invalid: number;
	unreferenced: number;
	plannedUploads: number;
	plannedOverwrites: number;
	plannedMetadataRepairs: number;
	plannedReuses: number;
	plannedDeletes: number;
}

export interface AssetReconciliationResult {
	policy: AssetPolicy;
	pruneAssets: boolean;
	reconciledAssets: ReconciledAsset[];
	unreferencedAssets: ReconciledAsset[];
	summary: AssetReconciliationSummary;
	blocked: boolean;
	blockReason?: string;
}

export interface AssetReconciliationOptions {
	canonicalAssets: InvitationPackageAsset[];
	targetDbAssets: TargetAssetRecord[];
	observedStorage: Record<string, ObservedStorageState>;
	policy?: AssetPolicy;
	pruneAssets?: boolean;
}

export function parseAssetPolicy(raw?: string): AssetPolicy {
	if (!raw) return 'missing';
	const normalized = raw.trim().toLowerCase();
	if (normalized === 'verify' || normalized === 'missing' || normalized === 'sync') {
		return normalized;
	}
	throw new Error(
		`Política de archivos no válida "${raw}". Debe ser "verify", "missing" o "sync".`,
	);
}

function checkMetadataMatch(canonical: InvitationPackageAsset, target: TargetAssetRecord): boolean {
	return (
		target.mimeType === canonical.mimeType &&
		(target.fileSize === null || canonical.fileSize === null || target.fileSize === canonical.fileSize) &&
		(target.width === null || canonical.width === null || target.width === canonical.width) &&
		(target.height === null || canonical.height === null || target.height === canonical.height)
	);
}

function reconcileBinaryPresentHashMatch(
	canonical: InvitationPackageAsset,
	dbRecord: TargetAssetRecord | undefined,
	storageState: ObservedStorageState,
	targetPath: string,
	policy: AssetPolicy,
): { item: ReconciledAsset; blocked: boolean; blockReason?: string } {
	const dbMatch = dbRecord ? checkMetadataMatch(canonical, dbRecord) : false;
	if (dbRecord && dbMatch) {
		return {
			item: {
				key: canonical.key,
				displayName: canonical.displayName,
				canonicalHash: canonical.sha256,
				canonicalSize: canonical.fileSize,
				canonicalMimeType: canonical.mimeType,
				targetStoragePath: targetPath,
				targetAssetId: dbRecord.id,
				classification: 'MATCH',
				plannedAction: 'REUSE',
				reasonCode: 'ASSET_MATCH_EXISTS',
				reason: `El archivo binario y los metadatos de "${canonical.displayName}" existen y coinciden (SHA-256: ${canonical.sha256.slice(0, 12)}…).`,
				observedHash: storageState.sha256,
				observedSize: dbRecord.fileSize,
			},
			blocked: false,
		};
	}

	const isVerify = policy === 'verify';
	return {
		item: {
			key: canonical.key,
			displayName: canonical.displayName,
			canonicalHash: canonical.sha256,
			canonicalSize: canonical.fileSize,
			canonicalMimeType: canonical.mimeType,
			targetStoragePath: targetPath,
			targetAssetId: dbRecord?.id,
			classification: 'BINARY_MATCH_METADATA_DRIFT',
			plannedAction: isVerify ? 'BLOCK' : 'REPAIR_METADATA',
			reasonCode: isVerify ? 'ASSET_METADATA_DRIFT_VERIFY_BLOCKED' : 'ASSET_METADATA_DRIFT',
			reason: isVerify
				? `El binario de "${canonical.displayName}" coincide pero falta o difiere el registro DB (bloqueado bajo política --asset-policy verify).`
				: `El binario de "${canonical.displayName}" coincide pero los metadatos en DB están desactualizados o faltan.`,
			observedHash: storageState.sha256,
			observedSize: dbRecord?.fileSize ?? null,
		},
		blocked: isVerify,
		blockReason: isVerify ? `Derivación de metadatos detectada bajo la política verify en "${canonical.displayName}".` : undefined,
	};
}

function reconcileBinaryPresentHashMismatch(
	canonical: InvitationPackageAsset,
	dbRecord: TargetAssetRecord | undefined,
	storageState: ObservedStorageState,
	targetPath: string,
	policy: AssetPolicy,
): { item: ReconciledAsset; blocked: boolean; blockReason?: string } {
	const isSync = policy === 'sync';
	return {
		item: {
			key: canonical.key,
			displayName: canonical.displayName,
			canonicalHash: canonical.sha256,
			canonicalSize: canonical.fileSize,
			canonicalMimeType: canonical.mimeType,
			targetStoragePath: targetPath,
			targetAssetId: dbRecord?.id,
			classification: 'CONTENT_MISMATCH',
			plannedAction: isSync ? 'OVERWRITE' : 'BLOCK',
			reasonCode: isSync ? 'ASSET_CONTENT_MISMATCH_SYNC_OVERWRITE' : 'ASSET_CONTENT_MISMATCH_BLOCKED',
			reason: isSync
				? `El archivo "${canonical.displayName}" existe pero contiene bytes diferentes. Se sobrescribirá bajo política sync.`
				: `El archivo "${canonical.displayName}" existe pero contiene un hash diferente (esperado: ${canonical.sha256.slice(0, 12)}…, hallado: ${storageState.sha256?.slice(0, 12) ?? 'desconocido'}). Bloqueado bajo política ${policy}. Use --asset-policy sync si desea sobrescribir.`,
			observedHash: storageState.sha256,
			observedSize: dbRecord?.fileSize ?? null,
		},
		blocked: !isSync,
		blockReason: !isSync ? `Conflicto de contenido binario no autorizado en "${canonical.displayName}".` : undefined,
	};
}

function reconcileBinaryAbsent(
	canonical: InvitationPackageAsset,
	dbRecord: TargetAssetRecord | undefined,
	targetPath: string,
	policy: AssetPolicy,
): { item: ReconciledAsset; blocked: boolean; blockReason?: string } {
	if (dbRecord) {
		return {
			item: {
				key: canonical.key,
				displayName: canonical.displayName,
				canonicalHash: canonical.sha256,
				canonicalSize: canonical.fileSize,
				canonicalMimeType: canonical.mimeType,
				targetStoragePath: targetPath,
				targetAssetId: dbRecord.id,
				classification: 'INVALID',
				plannedAction: 'BLOCK',
				reasonCode: 'ASSET_DB_ROW_MISSING_BINARY',
				reason: `El registro de base de datos para "${canonical.displayName}" apunta a un archivo binario inexistente (${targetPath}).`,
				observedHash: null,
				observedSize: dbRecord.fileSize,
			},
			blocked: true,
			blockReason: `Registro DB inconsistente en "${canonical.displayName}".`,
		};
	}

	const isVerify = policy === 'verify';
	return {
		item: {
			key: canonical.key,
			displayName: canonical.displayName,
			canonicalHash: canonical.sha256,
			canonicalSize: canonical.fileSize,
			canonicalMimeType: canonical.mimeType,
			targetStoragePath: targetPath,
			classification: 'MISSING',
			plannedAction: isVerify ? 'BLOCK' : 'UPLOAD',
			reasonCode: isVerify ? 'ASSET_MISSING_VERIFY_BLOCKED' : 'ASSET_MISSING_UPLOAD',
			reason: isVerify
				? `El archivo binario para "${canonical.displayName}" no existe en Storage (bloqueado bajo política --asset-policy verify).`
				: `El archivo binario para "${canonical.displayName}" no existe. Se subirá a Storage.`,
			observedHash: null,
			observedSize: null,
		},
		blocked: isVerify,
		blockReason: isVerify ? `Archivo binario requerido ausente bajo la política verify: "${canonical.displayName}".` : undefined,
	};
}

function reconcileCanonicalAsset(
	canonical: InvitationPackageAsset,
	dbRecord: TargetAssetRecord | undefined,
	storageState: ObservedStorageState,
	policy: AssetPolicy,
): { item: ReconciledAsset; blocked: boolean; blockReason?: string } {
	const targetPath = canonical.storagePath;

	if (!storageState.present) {
		return reconcileBinaryAbsent(canonical, dbRecord, targetPath, policy);
	}

	if (storageState.sha256 === canonical.sha256) {
		return reconcileBinaryPresentHashMatch(canonical, dbRecord, storageState, targetPath, policy);
	}

	return reconcileBinaryPresentHashMismatch(canonical, dbRecord, storageState, targetPath, policy);
}

function reconcileUnreferencedAssets(
	canonicalAssets: InvitationPackageAsset[],
	targetDbAssets: TargetAssetRecord[],
	observedStorage: Record<string, ObservedStorageState>,
	pruneAssets: boolean,
): { unreferencedAssets: ReconciledAsset[]; deletesCount: number } {
	const canonicalDisplayNames = new Set(canonicalAssets.map((a) => a.displayName));
	const unreferencedAssets: ReconciledAsset[] = [];
	let deletesCount = 0;

	for (const dbRecord of targetDbAssets) {
		if (!canonicalDisplayNames.has(dbRecord.displayName)) {
			const storageState = observedStorage[dbRecord.storagePath] ?? { present: true, sha256: null };
			const plannedAction: PlannedAssetAction = pruneAssets ? 'PRUNE' : 'RETAIN';
			if (pruneAssets) deletesCount++;

			unreferencedAssets.push({
				key: dbRecord.storagePath.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? dbRecord.displayName,
				displayName: dbRecord.displayName,
				canonicalHash: '',
				canonicalSize: null,
				canonicalMimeType: dbRecord.mimeType,
				targetStoragePath: dbRecord.storagePath,
				targetAssetId: dbRecord.id,
				classification: 'UNREFERENCED',
				plannedAction,
				reasonCode: pruneAssets ? 'ASSET_UNREFERENCED_PRUNE' : 'ASSET_UNREFERENCED_RETAIN',
				reason: pruneAssets
					? `El archivo "${dbRecord.displayName}" no pertenece al paquete canónico y se eliminará con --prune-assets.`
					: `El archivo "${dbRecord.displayName}" no pertenece al paquete canónico y se conservará.`,
				observedHash: storageState.sha256,
				observedSize: dbRecord.fileSize,
			});
		}
	}
	return { unreferencedAssets, deletesCount };
}

function reconcileCanonicalList(
	canonicalAssets: InvitationPackageAsset[],
	targetDbByDisplayName: Map<string, TargetAssetRecord>,
	targetDbByPath: Map<string, TargetAssetRecord>,
	observedStorage: Record<string, ObservedStorageState>,
	policy: AssetPolicy,
) {
	const reconciledAssets: ReconciledAsset[] = [];
	let isBlocked = false;
	let overallBlockReason: string | undefined;
	const counts = { match: 0, drift: 0, missing: 0, mismatch: 0, invalid: 0, uploads: 0, overwrites: 0, repairs: 0, reuses: 0 };

	for (const canonical of canonicalAssets) {
		const dbRecord =
			targetDbByDisplayName.get(canonical.displayName) ?? targetDbByPath.get(canonical.storagePath);
		const targetPath = dbRecord?.storagePath ?? canonical.storagePath;
		const storageState = observedStorage[targetPath] ?? observedStorage[canonical.storagePath] ?? {
			present: false,
			sha256: null,
		};

		const res = reconcileCanonicalAsset(canonical, dbRecord, storageState, policy);
		reconciledAssets.push(res.item);
		if (res.blocked) {
			isBlocked = true;
			overallBlockReason = overallBlockReason ?? res.blockReason;
		}

		switch (res.item.classification) {
			case 'MATCH': counts.match++; break;
			case 'BINARY_MATCH_METADATA_DRIFT': counts.drift++; break;
			case 'MISSING': counts.missing++; break;
			case 'CONTENT_MISMATCH': counts.mismatch++; break;
			case 'INVALID': counts.invalid++; break;
		}

		switch (res.item.plannedAction) {
			case 'REUSE': counts.reuses++; break;
			case 'REPAIR_METADATA': counts.repairs++; break;
			case 'UPLOAD': counts.uploads++; break;
			case 'OVERWRITE': counts.overwrites++; break;
		}
	}

	return { reconciledAssets, isBlocked, overallBlockReason, counts };
}

export function reconcileAssets(
	options: AssetReconciliationOptions,
): AssetReconciliationResult {
	const { canonicalAssets, targetDbAssets, observedStorage, policy = 'missing', pruneAssets = false } = options;

	const targetDbByDisplayName = new Map<string, TargetAssetRecord>();
	const targetDbByPath = new Map<string, TargetAssetRecord>();
	for (const record of targetDbAssets) {
		targetDbByDisplayName.set(record.displayName, record);
		targetDbByPath.set(record.storagePath, record);
	}

	const { reconciledAssets, isBlocked, overallBlockReason, counts } = reconcileCanonicalList(
		canonicalAssets,
		targetDbByDisplayName,
		targetDbByPath,
		observedStorage,
		policy,
	);

	const { unreferencedAssets, deletesCount } = reconcileUnreferencedAssets(
		canonicalAssets,
		targetDbAssets,
		observedStorage,
		pruneAssets,
	);

	return {
		policy,
		pruneAssets,
		reconciledAssets,
		unreferencedAssets,
		summary: {
			totalCanonical: canonicalAssets.length,
			match: counts.match,
			metadataDrift: counts.drift,
			missing: counts.missing,
			contentMismatch: counts.mismatch,
			invalid: counts.invalid,
			unreferenced: unreferencedAssets.length,
			plannedUploads: counts.uploads,
			plannedOverwrites: counts.overwrites,
			plannedMetadataRepairs: counts.repairs,
			plannedReuses: counts.reuses,
			plannedDeletes: deletesCount,
		},
		blocked: isBlocked,
		blockReason: overallBlockReason,
	};
}
