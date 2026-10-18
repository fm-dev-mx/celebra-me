import { randomUUID } from 'node:crypto';
import {
	buildCloudinaryOgImageUrl,
	buildCloudinaryPublicId,
} from '../../src/lib/intake/services/cloudinary-assets.ts';
import {
	R2_INVITATION_MEDIA,
	buildR2ObjectKey,
} from '../../src/lib/intake/services/r2-invitation-media.ts';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import { sqlLiteral } from '../db/db-workflow-lib.ts';

export interface NamespaceAssetSwap {
	oldId: string;
	newId: string;
	key: string;
	oldPublicId: string;
	newPublicId: string;
	newUrl: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
	providerVersion: string;
	providerMetadata: Record<string, unknown>;
	/** R2 destinations ship a prepared social card; Cloudinary derives it from `newUrl`. */
	newOgUrl?: string;
}

/** A literal content URL (for example invitation music) that no asset row owns. */
export interface NamespaceUrlSwap {
	oldUrl: string;
	newUrl: string;
}

export interface NamespaceRemapOptions {
	destination?: 'cloudinary' | 'r2';
	urlSwaps?: readonly NamespaceUrlSwap[];
}

export interface NamespaceAssetRetirement {
	id: string;
	publicId: string;
	sha256: string;
}

export interface NamespaceSnapshot {
	targetEnvironment: 'preview' | 'production';
	invitationId: string;
	slug: string;
	eventType: string;
	draft: { id: string; content: Record<string, unknown> } | null;
	published: { id: string; version: number; content: Record<string, unknown> } | null;
}

/** Roll back only the exact publication produced by a reviewed remap. */
export function buildNamespaceRollbackSql(
	before: NamespaceSnapshot,
	swaps: readonly NamespaceAssetSwap[],
	retirements: readonly NamespaceAssetRetirement[] = [],
	options: NamespaceRemapOptions = {},
): string {
	const contentChanges = countContentChanges(swaps, options);
	if (!before.draft || contentChanges + retirements.length === 0)
		throw new Error('Namespace rollback requires the original draft and asset manifest.');
	const expectedDraft = rewriteNamespaceRefs(before.draft.content, swaps, options);
	const expectedPublished = before.published
		? rewriteNamespaceRefs(before.published.content, swaps, options)
		: null;
	const assetStatements = swaps
		.map(
			(swap) => `
		select * into v_asset from public.invitation_assets where id = ${sqlLiteral(swap.newId)}::uuid
			and invitation_id = v_inv.id for update;
		if not found or v_asset.deleted_at is not null
			or v_asset.provider_public_id <> ${sqlLiteral(swap.newPublicId)}
		then raise exception 'namespace_rollback_target_changed'; end if;
		update public.invitation_assets set deleted_at = now(), updated_at = now() where id = v_asset.id;
		select * into v_asset from public.invitation_assets where id = ${sqlLiteral(swap.oldId)}::uuid
			and invitation_id = v_inv.id for update;
		if not found or v_asset.deleted_at is null
			or v_asset.provider_public_id <> ${sqlLiteral(swap.oldPublicId)}
		then raise exception 'namespace_rollback_source_changed'; end if;
		update public.invitation_assets set deleted_at = null, updated_at = now() where id = v_asset.id;`,
		)
		.join('\n');
	const retirementStatements = retirements
		.map(
			(retirement) => `
		select * into v_asset from public.invitation_assets where id = ${sqlLiteral(retirement.id)}::uuid
			and invitation_id = v_inv.id for update;
		if not found or v_asset.deleted_at is null
			or v_asset.provider_public_id <> ${sqlLiteral(retirement.publicId)}
		then raise exception 'namespace_rollback_retirement_changed'; end if;
		update public.invitation_assets set deleted_at = null, updated_at = now() where id = v_asset.id;`,
		)
		.join('\n');
	const publishStatement =
		before.published && expectedPublished && contentChanges > 0
			? `select * into v_pub from public.published_invitation_content
			where id = ${sqlLiteral(before.published.id)}::uuid and invitation_project_id = v_inv.id
			and deleted_at is null for update;
		if not found or v_pub.version <> ${before.published.version + 1}
			or v_pub.content <> ${sqlLiteral(JSON.stringify(expectedPublished))}::jsonb
		then raise exception 'namespace_rollback_publication_changed'; end if;
		v_metadata_hash := md5(jsonb_build_object(
			'archivedAt', v_inv.archived_at, 'eventType', v_inv.event_type,
			'kind', v_inv.kind, 'slug', v_inv.slug, 'status', v_inv.status,
			'themeId', v_inv.theme_id, 'title', v_inv.title
		)::text);
		perform public.publish_invitation_atomic(
			p_invitation_id => v_inv.id, p_draft_id => v_draft.id,
			p_expected_draft_updated_at => v_draft.updated_at,
			p_expected_published_version => v_pub.version,
			p_public_metadata_hash => md5(v_metadata_hash || chr(31) || md5(v_pub.content::text)),
			p_projection_hash => ${sqlLiteral(hashPublicationProjection(before.published.content))},
			p_idempotency_key => ${sqlLiteral(randomUUID())}::uuid,
			p_slug => v_inv.slug, p_event_type => v_inv.event_type, p_is_demo => false,
			p_content => ${sqlLiteral(JSON.stringify(before.published.content))}::jsonb
		);`
			: '';
	return `begin;
	do $namespace_rollback$
	declare
		v_inv public.invitations%rowtype;
		v_draft public.invitation_content_drafts%rowtype;
		v_pub public.published_invitation_content%rowtype;
		v_asset public.invitation_assets%rowtype;
		v_metadata_hash text;
	begin
		select * into v_inv from public.invitations where id = ${sqlLiteral(before.invitationId)}::uuid
			and slug = ${sqlLiteral(before.slug)} and event_type = ${sqlLiteral(before.eventType)}
			and archived_at is null for update;
		if not found then raise exception 'namespace_rollback_invitation_changed'; end if;
		select * into v_draft from public.invitation_content_drafts
			where id = ${sqlLiteral(before.draft.id)}::uuid and invitation_project_id = v_inv.id
			and deleted_at is null for update;
		if not found or v_draft.content <> ${sqlLiteral(JSON.stringify(expectedDraft))}::jsonb
		then raise exception 'namespace_rollback_draft_changed'; end if;
		${assetStatements}
		${retirementStatements}
		${
			contentChanges > 0
				? `update public.invitation_content_drafts set content = ${sqlLiteral(JSON.stringify(before.draft.content))}::jsonb,
			status = 'draft', updated_at = now() where id = v_draft.id returning * into v_draft;`
				: ''
		}
		${publishStatement}
	end $namespace_rollback$;
	commit;`;
}

export function rewriteNamespaceRefs(
	content: Record<string, unknown>,
	swaps: readonly NamespaceAssetSwap[],
	options: NamespaceRemapOptions = {},
): Record<string, unknown> {
	const byId = new Map(swaps.map((swap) => [swap.oldId, swap]));
	const byUrl = new Map((options.urlSwaps ?? []).map((swap) => [swap.oldUrl, swap.newUrl]));
	const ogUrl = (swap: NamespaceAssetSwap) =>
		swap.newOgUrl ?? buildCloudinaryOgImageUrl(swap.newUrl);
	const visit = (value: unknown, parentKey = ''): unknown => {
		if (Array.isArray(value)) return value.map((item) => visit(item, parentKey));
		if (typeof value === 'string') return byUrl.get(value) ?? value;
		if (value === null || typeof value !== 'object') return value;
		const record = value as Record<string, unknown>;
		if (record.type === 'uploaded' && typeof record.assetId === 'string') {
			const swap = byId.get(record.assetId);
			if (swap) {
				return {
					...record,
					assetId: swap.newId,
					src: parentKey === 'ogImage' ? ogUrl(swap) : swap.newUrl,
				};
			}
		}
		return Object.fromEntries(
			Object.entries(record).map(([key, child]) => [key, visit(child, key)]),
		);
	};
	const rewritten = visit(content) as Record<string, unknown>;
	const remaining = collectUploadedContentRefs(rewritten).filter((ref) => byId.has(ref.assetId));
	if (remaining.length > 0) throw new Error('Legacy uploaded references remain after remap.');
	const destinationUrls = new Set(swaps.flatMap((swap) => [swap.newUrl, ogUrl(swap)]));
	const hasLegacyValue = (value: unknown): boolean => {
		if (typeof value === 'string')
			return (
				byUrl.has(value) ||
				(!destinationUrls.has(value) &&
					swaps.some((swap) => value.includes(swap.oldPublicId)))
			);
		if (Array.isArray(value)) return value.some(hasLegacyValue);
		return (
			value !== null && typeof value === 'object' && Object.values(value).some(hasLegacyValue)
		);
	};
	if (hasLegacyValue(rewritten))
		throw new Error('Legacy Cloudinary URLs remain outside uploaded references.');
	return rewritten;
}

function remapDestination(options: NamespaceRemapOptions): 'cloudinary' | 'r2' {
	return options.destination ?? 'cloudinary';
}

function countContentChanges(
	swaps: readonly NamespaceAssetSwap[],
	options: NamespaceRemapOptions,
): number {
	return swaps.length + (options.urlSwaps?.length ?? 0);
}

function destinationPublicId(
	snapshot: NamespaceSnapshot,
	swap: NamespaceAssetSwap,
	destination: 'cloudinary' | 'r2',
): string {
	const identity = {
		eventType: snapshot.eventType,
		slug: snapshot.slug,
		key: swap.key,
		sha256: swap.sha256,
	};
	return destination === 'r2'
		? buildR2ObjectKey({ ...identity, mimeType: swap.mimeType })
		: buildCloudinaryPublicId({ ...identity, targetEnvironment: snapshot.targetEnvironment });
}

/** R2 rows name their environment bucket; Cloudinary rows keep the source row's bucket. */
function destinationBucketSql(
	snapshot: NamespaceSnapshot,
	destination: 'cloudinary' | 'r2',
): string {
	return destination === 'r2'
		? sqlLiteral(R2_INVITATION_MEDIA[snapshot.targetEnvironment].bucket)
		: 'v_asset.bucket';
}

/** One PostgreSQL transaction owns the row swap, draft update, and publication RPC. */
export function buildNamespaceRemapSql(
	snapshot: NamespaceSnapshot,
	swaps: readonly NamespaceAssetSwap[],
	retirements: readonly NamespaceAssetRetirement[] = [],
	options: NamespaceRemapOptions = {},
): string {
	const destination = remapDestination(options);
	const contentChanges = countContentChanges(swaps, options);
	if (contentChanges + retirements.length === 0)
		throw new Error('Namespace remap requires at least one asset.');
	if (!snapshot.draft) throw new Error('Namespace remap requires an active draft.');
	const ids = new Set<string>();
	for (const swap of swaps) {
		if (ids.has(swap.oldId)) throw new Error('Duplicate source asset in namespace remap.');
		ids.add(swap.oldId);
		if (!/^[a-f0-9]{64}$/u.test(swap.sha256) || swap.width <= 0 || swap.height <= 0)
			throw new Error('Namespace remap asset metadata is incomplete.');
		if (swap.newPublicId !== destinationPublicId(snapshot, swap, destination))
			throw new Error('Namespace remap target belongs to another invitation.');
	}
	const draft = rewriteNamespaceRefs(snapshot.draft.content, swaps, options);
	const published = snapshot.published
		? rewriteNamespaceRefs(snapshot.published.content, swaps, options)
		: null;
	const destinationBucket = destinationBucketSql(snapshot, destination);
	const activeContentJson = `${JSON.stringify(draft)} ${JSON.stringify(published)}`;
	for (const retirement of retirements) {
		if (ids.has(retirement.id)) throw new Error('Duplicate source asset in namespace remap.');
		ids.add(retirement.id);
		if (
			activeContentJson.includes(retirement.id) ||
			activeContentJson.includes(retirement.publicId)
		)
			throw new Error('Cannot retire an asset still referenced by invitation content.');
	}
	const assetStatements = swaps
		.map(
			(swap) => `
		select * into v_asset from public.invitation_assets
		where id = ${sqlLiteral(swap.oldId)}::uuid and invitation_id = v_inv.id for update;
		if not found or v_asset.deleted_at is not null or v_asset.provider <> 'cloudinary'
			or v_asset.provider_public_id <> ${sqlLiteral(swap.oldPublicId)}
			or v_asset.sha256 <> ${sqlLiteral(swap.sha256)}
			or v_asset.mime_type <> ${sqlLiteral(swap.mimeType)}
			or v_asset.width <> ${swap.width} or v_asset.height <> ${swap.height}
		then raise exception 'namespace_source_changed'; end if;
		update public.invitation_assets set deleted_at = now(), updated_at = now() where id = v_asset.id;
		insert into public.invitation_assets (
			id, invitation_id, display_name, default_alt_text, bucket, storage_path,
			mime_type, width, height, file_size, validation_version, original_mime_type,
			original_file_size, provider, provider_public_id, provider_version, secure_url,
			sha256, provider_metadata, managed_by_definition_slug, managed_source_key,
			managed_sha256, managed_operation_id
		) values (
			${sqlLiteral(swap.newId)}::uuid, v_asset.invitation_id, v_asset.display_name,
			v_asset.default_alt_text, ${destinationBucket}, ${sqlLiteral(swap.newPublicId)},
			v_asset.mime_type, v_asset.width, v_asset.height, v_asset.file_size,
			v_asset.validation_version, v_asset.original_mime_type, v_asset.original_file_size,
			${sqlLiteral(destination)}, ${sqlLiteral(swap.newPublicId)}, ${sqlLiteral(swap.providerVersion)},
			${sqlLiteral(swap.newUrl)}, v_asset.sha256,
			${sqlLiteral(JSON.stringify(swap.providerMetadata))}::jsonb,
			v_asset.managed_by_definition_slug, v_asset.managed_source_key,
			v_asset.managed_sha256, v_asset.managed_operation_id
		);`,
		)
		.join('\n');
	const retirementStatements = retirements
		.map(
			(retirement) => `
		select * into v_asset from public.invitation_assets
		where id = ${sqlLiteral(retirement.id)}::uuid and invitation_id = v_inv.id for update;
		if not found or v_asset.deleted_at is not null or v_asset.provider <> 'cloudinary'
			or v_asset.provider_public_id <> ${sqlLiteral(retirement.publicId)}
			or v_asset.sha256 <> ${sqlLiteral(retirement.sha256)}
		then raise exception 'namespace_retirement_source_changed'; end if;
		update public.invitation_assets set deleted_at = now(), updated_at = now() where id = v_asset.id;`,
		)
		.join('\n');
	const draftStatement =
		contentChanges > 0
			? `update public.invitation_content_drafts set content = ${sqlLiteral(JSON.stringify(draft))}::jsonb,
			status = 'draft', updated_at = now() where id = v_draft.id returning * into v_draft;`
			: '';
	const publishStatement =
		contentChanges > 0 && snapshot.published && published
			? `
		select * into v_pub from public.published_invitation_content
		where id = ${sqlLiteral(snapshot.published.id)}::uuid and invitation_project_id = v_inv.id
			and deleted_at is null for update;
		if not found or v_pub.version <> ${snapshot.published.version}
			or v_pub.content <> ${sqlLiteral(JSON.stringify(snapshot.published.content))}::jsonb
		then raise exception 'namespace_publication_changed'; end if;
		v_metadata_hash := md5(jsonb_build_object(
			'archivedAt', v_inv.archived_at, 'eventType', v_inv.event_type,
			'kind', v_inv.kind, 'slug', v_inv.slug, 'status', v_inv.status,
			'themeId', v_inv.theme_id, 'title', v_inv.title
		)::text);
		perform public.publish_invitation_atomic(
			p_invitation_id => v_inv.id, p_draft_id => v_draft.id,
			p_expected_draft_updated_at => v_draft.updated_at,
			p_expected_published_version => v_pub.version,
			p_public_metadata_hash => md5(v_metadata_hash || chr(31) || md5(v_pub.content::text)),
			p_projection_hash => ${sqlLiteral(hashPublicationProjection(published))},
			p_idempotency_key => ${sqlLiteral(randomUUID())}::uuid,
			p_slug => v_inv.slug, p_event_type => v_inv.event_type, p_is_demo => false,
			p_content => ${sqlLiteral(JSON.stringify(published))}::jsonb
		);`
			: '';
	return `begin;
	do $namespace_remap$
	declare
		v_inv public.invitations%rowtype;
		v_draft public.invitation_content_drafts%rowtype;
		v_pub public.published_invitation_content%rowtype;
		v_asset public.invitation_assets%rowtype;
		v_metadata_hash text;
	begin
		select * into v_inv from public.invitations where id = ${sqlLiteral(snapshot.invitationId)}::uuid
			and slug = ${sqlLiteral(snapshot.slug)} and event_type = ${sqlLiteral(snapshot.eventType)}
			and archived_at is null for update;
		if not found then raise exception 'namespace_invitation_changed'; end if;
		select * into v_draft from public.invitation_content_drafts
			where id = ${sqlLiteral(snapshot.draft.id)}::uuid and invitation_project_id = v_inv.id
				and deleted_at is null for update;
		if not found or v_draft.content <> ${sqlLiteral(JSON.stringify(snapshot.draft.content))}::jsonb
		then raise exception 'namespace_draft_changed'; end if;
		${assetStatements}
		${retirementStatements}
		${draftStatement}
		${publishStatement}
	end $namespace_remap$;
	commit;`;
}
