/** Read-only namespace inventory for all active published client invitation images. */
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import {
	buildCloudinaryPublicId,
	classifyCloudinaryPublicIdEnvironment,
} from '../../src/lib/intake/services/cloudinary-assets.ts';
import {
	assertPreviewDbUrl,
	assertProductionDbUrl,
	getPreviewDbUrl,
	getProdDbUrl,
	runPsql,
} from '../db/db-workflow-lib.ts';
import { redactCredentials } from '../db/db-target-config.ts';

type Target = 'preview' | 'production';
type InventoryUsage = {
	published: boolean;
	draft: boolean;
	historical: boolean;
	unreferenced: boolean;
};
type MigrationStatus = 'CURRENT' | 'MIGRATION_CANDIDATE' | 'BLOCKED';
type InventoryStatus = 'CURRENT' | 'REVIEW' | 'BLOCKED';
export interface InventoryAsset {
	id: string;
	key: string | null;
	provider: string | null;
	publicId: string | null;
	sha256: string | null;
	mimeType: string | null;
}
export interface InventoryInvitation {
	slug: string;
	eventType: string;
	content: Record<string, unknown>;
	draftContent?: Record<string, unknown> | null;
	historicalContents?: Record<string, unknown>[];
	assets: InventoryAsset[];
}
export interface ImageInventoryFinding {
	kind: 'ACTIVE_ASSET' | 'MISSING_REFERENCE';
	route: string;
	key: string;
	assetId: string;
	usage: InventoryUsage;
	referenced: boolean;
	draftReferenced: boolean;
	historicalReferenced: boolean;
	delivery: 'NOT_CHECKED';
	status: InventoryStatus;
	migration: MigrationStatus;
	namespace: string;
	sourcePublicId: string | null;
	targetPublicId: string | null;
	locations: string[];
	reasons: string[];
}

type CollectedUsage = InventoryUsage & { locations: Set<string> };
const SAFE_MIGRATION_REASON = 'namespace legacy: candidata de migración segura';

function redactInventoryValue(value: string): string {
	return redactCredentials(value).replace(/https?:\/\/[^\s"'<>]+/giu, '[URL redactada]');
}

function addReferences(
	usageById: Map<string, CollectedUsage>,
	items: ReturnType<typeof collectUploadedContentRefs>,
	usage: 'published' | 'draft' | 'historical',
): void {
	for (const ref of items) {
		const current = usageById.get(ref.assetId) ?? {
			published: false,
			draft: false,
			historical: false,
			unreferenced: false,
			locations: new Set<string>(),
		};
		current[usage] = true;
		current.locations.add(ref.path);
		usageById.set(ref.assetId, current);
	}
}

function collectUsageByAssetId(invitation: InventoryInvitation): Map<string, CollectedUsage> {
	const usageById = new Map<string, CollectedUsage>();
	addReferences(usageById, collectUploadedContentRefs(invitation.content), 'published');
	addReferences(usageById, collectUploadedContentRefs(invitation.draftContent), 'draft');
	for (const content of invitation.historicalContents ?? [])
		addReferences(usageById, collectUploadedContentRefs(content), 'historical');
	return usageById;
}

function hasReferences(usage: InventoryUsage): boolean {
	return usage.published || usage.draft || usage.historical;
}

function normalizedUsage(usage?: CollectedUsage): InventoryUsage {
	return usage
		? {
				published: usage.published,
				draft: usage.draft,
				historical: usage.historical,
				unreferenced: false,
			}
		: { published: false, draft: false, historical: false, unreferenced: true };
}

function missingReferenceRows(
	route: string,
	usageById: Map<string, CollectedUsage>,
	assetIds: ReadonlySet<string>,
): ImageInventoryFinding[] {
	const rows: ImageInventoryFinding[] = [];
	for (const [assetId, usage] of usageById) {
		if (assetIds.has(assetId)) continue;
		const locations = [...usage.locations].sort();
		const inventoryUsage = normalizedUsage(usage);
		rows.push({
			kind: 'MISSING_REFERENCE',
			route: redactInventoryValue(route),
			key: redactInventoryValue(locations[0] ?? assetId),
			assetId: redactInventoryValue(assetId),
			usage: inventoryUsage,
			referenced: inventoryUsage.published,
			draftReferenced: inventoryUsage.draft,
			historicalReferenced: inventoryUsage.historical,
			delivery: 'NOT_CHECKED',
			status: 'BLOCKED',
			migration: 'BLOCKED',
			namespace: 'missing',
			sourcePublicId: null,
			targetPublicId: null,
			locations: locations.map(redactInventoryValue),
			reasons: ['referencia de contenido sin fila activa de asset'],
		});
	}
	return rows;
}

interface AssetMigrationAssessment {
	namespace: string;
	targetPublicId: string | null;
	migration: MigrationStatus;
	reasons: string[];
}

interface AssetMetadataAssessment {
	reasons: string[];
	blocksMigration: boolean;
}

function namespaceReasons(
	namespace: string,
	target: Target,
	targetPublicId: string | null,
	belongsToInvitation: boolean,
): AssetMetadataAssessment {
	const reasons: string[] = [];
	let blocksMigration = false;
	if (namespace === target && !belongsToInvitation) {
		reasons.push('el public ID pertenece a otra invitación');
		blocksMigration = true;
	}
	if (namespace === 'legacy' && targetPublicId) reasons.push(SAFE_MIGRATION_REASON);
	else if (namespace !== target) {
		reasons.push('namespace de imagen: ' + namespace);
		blocksMigration = true;
	}
	return { reasons, blocksMigration };
}

interface AssetValidation {
	isKnownImage: boolean;
	validHash: boolean;
	validKey: boolean;
	validPublicId: boolean;
	canDeriveTarget: boolean;
}

function validateAsset(asset: InventoryAsset): AssetValidation {
	const isKnownImage = asset.mimeType?.startsWith('image/') === true;
	const validHash = /^[a-f0-9]{64}$/u.test(asset.sha256 ?? '');
	const validKey = Boolean(asset.key?.trim());
	const validPublicId = Boolean(asset.publicId && !/^https?:\/\//iu.test(asset.publicId));
	const canDeriveTarget =
		validHash && validKey && validPublicId && isKnownImage && asset.provider === 'cloudinary';
	return { isKnownImage, validHash, validKey, validPublicId, canDeriveTarget };
}

function assetMetadataReasons(
	asset: InventoryAsset,
	invitation: InventoryInvitation,
	target: Target,
	namespace: string,
	targetPublicId: string | null,
	duplicate: boolean,
	validation: AssetValidation,
): AssetMetadataAssessment {
	const { isKnownImage, validHash, validKey, validPublicId } = validation;
	const reasons: string[] = [];
	let blocksMigration = false;
	if (!isKnownImage) {
		reasons.push('MIME faltante o asset que no es imagen');
		blocksMigration = true;
	}
	if (asset.provider !== 'cloudinary') {
		reasons.push('proveedor de imagen distinto de Cloudinary');
		blocksMigration = true;
	}
	if (!validKey) {
		reasons.push('falta la clave administrada del asset');
		blocksMigration = true;
	}
	if (!validPublicId) {
		reasons.push('falta el public ID de Cloudinary o es inválido');
		blocksMigration = true;
	}
	if (!validHash) {
		reasons.push('falta el SHA-256 o no es válido');
		blocksMigration = true;
	}
	const prefix = target + '/' + invitation.eventType + '/' + invitation.slug + '/assets/';
	const namespaceAssessment = namespaceReasons(
		namespace,
		target,
		targetPublicId,
		asset.publicId?.startsWith(prefix) ?? false,
	);
	reasons.push(...namespaceAssessment.reasons);
	blocksMigration ||= namespaceAssessment.blocksMigration;
	if (duplicate) {
		reasons.push('identidad o clave duplicada entre assets activos');
		blocksMigration = true;
	}
	if (namespace === 'legacy' && !targetPublicId && validKey && validHash && isKnownImage) {
		reasons.push('no se puede calcular el destino de migración con la clave y el SHA-256');
		blocksMigration = true;
	}
	return { reasons, blocksMigration };
}

function migrationStatusForAsset(
	namespace: string,
	target: Target,
	targetPublicId: string | null,
	duplicate: boolean,
	blocksMigration: boolean,
): MigrationStatus {
	if (namespace === target && !blocksMigration) return 'CURRENT';
	if (namespace === 'legacy' && targetPublicId && !duplicate && !blocksMigration)
		return 'MIGRATION_CANDIDATE';
	return 'BLOCKED';
}

function assessAssetMigration(
	asset: InventoryAsset,
	invitation: InventoryInvitation,
	target: Target,
	duplicate: boolean,
): AssetMigrationAssessment {
	const namespace = asset.publicId
		? classifyCloudinaryPublicIdEnvironment(asset.publicId)
		: 'missing';
	const validation = validateAsset(asset);
	const targetPublicId = proposeLegacyPublicId(
		asset,
		invitation,
		target,
		namespace,
		validation.canDeriveTarget,
	);
	const metadata = assetMetadataReasons(
		asset,
		invitation,
		target,
		namespace,
		targetPublicId,
		duplicate,
		validation,
	);
	const migration = migrationStatusForAsset(
		namespace,
		target,
		targetPublicId,
		duplicate,
		metadata.blocksMigration,
	);
	return { namespace, targetPublicId, migration, reasons: metadata.reasons };
}

function assetDuplicate(
	asset: InventoryAsset,
	assetCountsById: ReadonlyMap<string, number>,
	assetCountsByKey: ReadonlyMap<string, number>,
): boolean {
	return (
		(assetCountsById.get(asset.id) ?? 0) > 1 ||
		Boolean(asset.key && (assetCountsByKey.get(asset.key) ?? 0) > 1)
	);
}

function assetInventoryRow(
	route: string,
	asset: InventoryAsset,
	invitation: InventoryInvitation,
	target: Target,
	collectedUsage: CollectedUsage | undefined,
	duplicate: boolean,
): ImageInventoryFinding | null {
	const usage = normalizedUsage(collectedUsage);
	const knownNonImage = Boolean(asset.mimeType && !asset.mimeType.startsWith('image/'));
	if (knownNonImage && !hasReferences(usage)) return null;
	const assessment = assessAssetMigration(asset, invitation, target, duplicate);
	const status: InventoryStatus =
		assessment.migration === 'CURRENT' && !usage.unreferenced
			? 'CURRENT'
			: assessment.migration === 'BLOCKED' && hasReferences(usage)
				? 'BLOCKED'
				: 'REVIEW';
	const reasons = [...assessment.reasons];
	if (usage.unreferenced)
		reasons.push('fila activa sin referencias en publicación, borrador o historial');
	return {
		kind: 'ACTIVE_ASSET',
		route: redactInventoryValue(route),
		key: redactInventoryValue(asset.key || asset.id),
		assetId: redactInventoryValue(asset.id),
		usage,
		referenced: usage.published,
		draftReferenced: usage.draft,
		historicalReferenced: usage.historical,
		delivery: 'NOT_CHECKED',
		status,
		migration: assessment.migration,
		namespace: assessment.namespace,
		sourcePublicId: redactPublicId(asset.publicId),
		targetPublicId: assessment.targetPublicId
			? redactInventoryValue(assessment.targetPublicId)
			: null,
		locations: [...(collectedUsage?.locations ?? [])].sort().map(redactInventoryValue),
		reasons: [...new Set(reasons)],
	};
}

function assetCounts(invitation: InventoryInvitation): {
	byId: Map<string, number>;
	byKey: Map<string, number>;
} {
	const byId = new Map<string, number>();
	const byKey = new Map<string, number>();
	for (const asset of invitation.assets) {
		byId.set(asset.id, (byId.get(asset.id) ?? 0) + 1);
		if (asset.key) byKey.set(asset.key, (byKey.get(asset.key) ?? 0) + 1);
	}
	return { byId, byKey };
}

export function inspectHostedImageInventory(
	invitations: readonly InventoryInvitation[],
	target: Target,
): ImageInventoryFinding[] {
	const findings: ImageInventoryFinding[] = [];
	for (const invitation of invitations) {
		const route = '/' + invitation.eventType + '/' + invitation.slug;
		const usageById = collectUsageByAssetId(invitation);
		const counts = assetCounts(invitation);
		findings.push(...missingReferenceRows(route, usageById, new Set(counts.byId.keys())));
		for (const asset of invitation.assets) {
			const row = assetInventoryRow(
				route,
				asset,
				invitation,
				target,
				usageById.get(asset.id),
				assetDuplicate(asset, counts.byId, counts.byKey),
			);
			if (row) findings.push(row);
		}
	}
	return findings.sort(compareFindings);
}

function redactPublicId(value: string | null): string | null {
	if (!value) return null;
	return redactInventoryValue(value);
}

function proposeLegacyPublicId(
	asset: InventoryAsset,
	invitation: InventoryInvitation,
	target: Target,
	namespace: string,
	canDeriveTarget: boolean,
): string | null {
	if (namespace !== 'legacy' || !canDeriveTarget || !asset.key || !asset.sha256) return null;
	return buildCloudinaryPublicId({
		targetEnvironment: target,
		eventType: invitation.eventType,
		slug: invitation.slug,
		key: asset.key,
		sha256: asset.sha256,
	});
}
function compareFindings(a: ImageInventoryFinding, b: ImageInventoryFinding): number {
	return (
		a.route.localeCompare(b.route) ||
		a.key.localeCompare(b.key) ||
		a.assetId.localeCompare(b.assetId)
	);
}

export interface HostedImageInventoryReport {
	environment: Target;
	delivery: 'NOT_CHECKED';
	status: 'CURRENT' | 'REVIEW' | 'BLOCKED';
	clientInvitations: number;
	imageRows: number;
	missingReferenceRows: number;
	legacyImageRows: number;
	summary: {
		current: number;
		migrationCandidates: number;
		unreferenced: number;
		blocked: number;
		review: number;
	};
	rows: ImageInventoryFinding[];
	findings: ImageInventoryFinding[];
}

export function buildHostedImageInventoryReport(
	invitations: readonly InventoryInvitation[],
	target: Target,
): HostedImageInventoryReport {
	const rows = inspectHostedImageInventory(invitations, target);
	const findings = rows.filter((row) => row.status !== 'CURRENT');
	const blocked = rows.filter((row) => row.status === 'BLOCKED').length;
	const review = rows.filter((row) => row.status === 'REVIEW').length;
	const legacyRows = rows.filter((row) => row.namespace === 'legacy');
	return {
		environment: target,
		delivery: 'NOT_CHECKED',
		status: blocked > 0 ? 'BLOCKED' : review > 0 ? 'REVIEW' : 'CURRENT',
		clientInvitations: invitations.length,
		imageRows: rows.filter((row) => row.kind === 'ACTIVE_ASSET').length,
		missingReferenceRows: rows.filter((row) => row.kind === 'MISSING_REFERENCE').length,
		legacyImageRows: legacyRows.length,
		summary: {
			current: rows.filter((row) => row.status === 'CURRENT').length,
			migrationCandidates: rows.filter((row) => row.migration === 'MIGRATION_CANDIDATE')
				.length,
			unreferenced: rows.filter((row) => row.usage.unreferenced).length,
			blocked,
			review,
		},
		rows,
		findings,
	};
}

export function formatHostedImageInventoryReport(report: HostedImageInventoryReport): string {
	const lines = [
		`${report.environment}: inventario de imágenes; entrega HTTP/MIME/hash: ${report.delivery}.`,
		`${report.clientInvitations} invitaciones · ${report.imageRows} filas de imagen · ` +
			`${report.missingReferenceRows} referencias sin fila activa · ${report.summary.current} actuales · ${report.summary.migrationCandidates} candidatas de migración · ` +
			`${report.summary.unreferenced} sin referencias · ${report.summary.blocked} bloqueantes · ` +
			`${report.summary.review} para revisión.`,
	];
	for (const row of report.findings) {
		const uses = [
			row.usage.published && 'publicada',
			row.usage.draft && 'borrador',
			row.usage.historical && 'historial',
			row.usage.unreferenced && 'sin referencias',
		]
			.filter(Boolean)
			.join(',');
		lines.push(
			`${row.status} ${row.route} ${row.key} [${uses || 'sin referencias'}] migration=${row.migration}: ${row.reasons.join('; ')}`,
		);
	}
	return lines.join('\n') + '\n';
}

export function hostedImageInventoryExitCode(
	status: 'CURRENT' | 'REVIEW' | 'BLOCKED' | 'UNVERIFIED',
): 0 | 1 {
	return status === 'BLOCKED' || status === 'UNVERIFIED' ? 1 : 0;
}

export function buildHostedImageInventoryQuery(): string {
	return [
		"select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (",
		'select i.slug, i.event_type as "eventType",',
		"coalesce(to_jsonb(pub.content), '{}'::jsonb) as content,",
		"(select coalesce(json_agg(history.content), '[]'::json) from public.published_invitation_content history",
		'where history.invitation_project_id = i.id and history.deleted_at is null',
		'and history.id is distinct from (select current.id from public.published_invitation_content current',
		'where current.invitation_project_id = i.id and current.deleted_at is null',
		'order by current.version desc limit 1)) as "historicalContents",',
		'(select content from public.invitation_content_drafts where invitation_project_id = i.id',
		'and deleted_at is null order by updated_at desc limit 1) as "draftContent",',
		'coalesce((select json_agg(json_build_object(',
		"'id', a.id::text, 'key', a.managed_source_key, 'provider', a.provider,",
		"'publicId', a.provider_public_id, 'sha256', a.sha256, 'mimeType', a.mime_type))",
		"from public.invitation_assets a where a.invitation_id = i.id and a.deleted_at is null), '[]'::json) as assets",
		'from public.invitations i left join lateral (',
		'select content from public.published_invitation_content',
		'where invitation_project_id = i.id and deleted_at is null',
		'order by version desc limit 1) pub on true',
		"where i.archived_at is null and i.kind = 'client'",
		') t;',
	].join(' ');
}

function readInventory(target: Target): InventoryInvitation[] {
	const dbUrl = target === 'preview' ? getPreviewDbUrl().url : getProdDbUrl().url;
	if (target === 'preview') assertPreviewDbUrl(dbUrl);
	else assertProductionDbUrl(dbUrl);
	const result = runPsql(buildHostedImageInventoryQuery(), dbUrl, {
		tuplesOnly: true,
		throwOnError: true,
	});
	return JSON.parse(result.stdout.trim()) as InventoryInvitation[];
}

export function redactDiagnostic(message: string): string {
	return redactInventoryValue(message).replace(
		/(password|token|secret)\s*[:=]\s*[^\s,;]+/giu,
		'$1=[redactado]',
	);
}

function main(): void {
	const target = process.argv[2];
	if (target !== 'preview' && target !== 'production')
		throw new Error('Usage: hosted-image-inventory.ts <preview|production> [--json].');
	const report = buildHostedImageInventoryReport(readInventory(target), target);
	if (process.argv.includes('--json'))
		process.stdout.write(JSON.stringify(report, null, 2) + '\n');
	else process.stdout.write(formatHostedImageInventoryReport(report));
	process.exitCode = hostedImageInventoryExitCode(report.status);
}
if (process.argv[1]?.endsWith('hosted-image-inventory.ts')) {
	try {
		main();
	} catch (error: unknown) {
		const message = redactDiagnostic(
			error instanceof Error ? error.message : 'Inventory failed',
		);
		if (process.argv.includes('--json')) {
			process.stdout.write(
				JSON.stringify(
					{
						environment:
							process.argv[2] === 'preview' || process.argv[2] === 'production'
								? process.argv[2]
								: null,
						delivery: 'NOT_CHECKED',
						status: 'UNVERIFIED',
						error: message,
					},
					null,
					2,
				) + '\n',
			);
		} else process.stderr.write(`UNVERIFIED ${message}\n`);
		process.exitCode = hostedImageInventoryExitCode('UNVERIFIED');
	}
}
