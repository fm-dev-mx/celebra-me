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

type Target = 'preview' | 'production';
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
	assets: InventoryAsset[];
}
export interface ImageInventoryFinding {
	route: string;
	key: string;
	assetId: string;
	referenced: boolean;
	draftReferenced: boolean;
	namespace: string;
	sourcePublicId: string | null;
	targetPublicId: string | null;
	reasons: string[];
}

export function inspectHostedImageInventory(
	invitations: readonly InventoryInvitation[],
	target: Target,
): ImageInventoryFinding[] {
	const findings: ImageInventoryFinding[] = [];
	for (const invitation of invitations) {
		const route = '/' + invitation.eventType + '/' + invitation.slug;
		const refs = collectUploadedContentRefs(invitation.content);
		const draftRefs = collectUploadedContentRefs(invitation.draftContent);
		const byId = new Map(invitation.assets.map((asset) => [asset.id, asset]));
		const referencedIds = new Set(refs.map((ref) => ref.assetId));
		const draftReferencedIds = new Set(draftRefs.map((ref) => ref.assetId));
		const missingRefs = new Map([...refs, ...draftRefs].map((ref) => [ref.assetId, ref.path]));
		for (const [assetId, path] of missingRefs) {
			if (byId.has(assetId)) continue;
			findings.push({
				route,
				key: path,
				assetId,
				referenced: referencedIds.has(assetId),
				draftReferenced: draftReferencedIds.has(assetId),
				namespace: 'missing',
				sourcePublicId: null,
				targetPublicId: null,
				reasons: ['content reference has no active asset row'],
			});
		}
		for (const asset of invitation.assets) {
			if (!asset.mimeType?.startsWith('image/')) continue;
			const namespace = asset.publicId
				? classifyCloudinaryPublicIdEnvironment(asset.publicId)
				: 'missing';
			const reasons: string[] = [];
			const validHash = /^[a-f0-9]{64}$/u.test(asset.sha256 ?? '');
			const targetPublicId = proposeLegacyPublicId(
				asset,
				invitation,
				target,
				namespace,
				validHash,
			);
			if (asset.provider !== 'cloudinary') reasons.push('image provider is not Cloudinary');
			if (namespace !== target) reasons.push('image namespace is ' + namespace);
			const prefix = target + '/' + invitation.eventType + '/' + invitation.slug + '/assets/';
			if (namespace === target && !asset.publicId?.startsWith(prefix))
				reasons.push('image belongs to another invitation');
			if (!validHash) reasons.push('image SHA-256 is missing or invalid');
			if (namespace === 'legacy' && !targetPublicId)
				reasons.push('migration target cannot be derived from key and SHA-256');
			findings.push({
				route,
				key: asset.key || asset.id,
				assetId: asset.id,
				referenced: referencedIds.has(asset.id),
				draftReferenced: draftReferencedIds.has(asset.id),
				sourcePublicId: asset.publicId,
				targetPublicId,
				namespace,
				reasons,
			});
		}
	}
	return findings.sort(compareFindings);
}

function proposeLegacyPublicId(
	asset: InventoryAsset,
	invitation: InventoryInvitation,
	target: Target,
	namespace: string,
	validHash: boolean,
): string | null {
	if (namespace !== 'legacy' || !asset.key || !validHash || !asset.sha256) return null;
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

function readInventory(target: Target): InventoryInvitation[] {
	const dbUrl = target === 'preview' ? getPreviewDbUrl().url : getProdDbUrl().url;
	if (target === 'preview') assertPreviewDbUrl(dbUrl);
	else assertProductionDbUrl(dbUrl);
	const sql = [
		"select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (",
		'select i.slug, i.event_type as "eventType", pub.content,',
		'(select content from public.invitation_content_drafts where invitation_project_id = i.id',
		'and deleted_at is null order by updated_at desc limit 1) as "draftContent",',
		'coalesce((select json_agg(json_build_object(',
		"'id', a.id::text, 'key', a.managed_source_key, 'provider', a.provider,",
		"'publicId', a.provider_public_id, 'sha256', a.sha256, 'mimeType', a.mime_type))",
		"from public.invitation_assets a where a.invitation_id = i.id and a.deleted_at is null), '[]'::json) as assets",
		'from public.invitations i join lateral (',
		'select content from public.published_invitation_content',
		'where invitation_project_id = i.id and deleted_at is null',
		'order by version desc limit 1) pub on true',
		"where i.archived_at is null and i.kind = 'client'",
		') t;',
	].join(' ');
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return JSON.parse(result.stdout.trim()) as InventoryInvitation[];
}

function main(): void {
	const target = process.argv[2];
	if (target !== 'preview' && target !== 'production')
		throw new Error('Usage: hosted-image-inventory.ts <preview|production> [--json]');
	const invitations = readInventory(target);
	const findings = inspectHostedImageInventory(invitations, target);
	const legacy = findings.filter((item) => item.namespace === 'legacy');
	const invalid = findings.filter((item) => item.reasons.length > 0);
	const report = {
		environment: target,
		publishedInvitations: invitations.length,
		imageRows: findings.filter((item) => item.namespace !== 'missing').length,
		legacyImageRows: legacy.length,
		copyCandidates: legacy.filter((item) => item.targetPublicId).length,
		referencedLegacyImageRows: legacy.filter((item) => item.referenced).length,
		draftReferencedLegacyImageRows: legacy.filter((item) => item.draftReferenced).length,
		findings: invalid,
	};
	if (process.argv.includes('--json'))
		process.stdout.write(JSON.stringify(report, null, 2) + '\n');
	else {
		process.stdout.write(
			target +
				': ' +
				report.publishedInvitations +
				' published invitations; ' +
				report.imageRows +
				' image rows; ' +
				report.legacyImageRows +
				' legacy rows; ' +
				report.referencedLegacyImageRows +
				' published references; ' +
				report.draftReferencedLegacyImageRows +
				' draft references.\n',
		);
		for (const finding of invalid)
			process.stdout.write(
				finding.route + ' ' + finding.key + ': ' + finding.reasons.join(', ') + '\n',
			);
	}
	if (invalid.length > 0) process.exitCode = 1;
}
if (process.argv[1]?.endsWith('hosted-image-inventory.ts')) {
	try {
		main();
	} catch (error: unknown) {
		process.stderr.write((error instanceof Error ? error.message : 'Inventory failed') + '\n');
		process.exitCode = 1;
	}
}
