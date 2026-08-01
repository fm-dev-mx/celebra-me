/**
 * invitation-definition.ts — Single-File Invitation Definition Contract
 *
 * Defines the standard typed interface and helper for versioned, single-file
 * invitation definitions in Celebra-me.
 *
 * Invitation definitions contain content structure, asset metadata, timing,
 * and location data, but do NOT contain environment settings, DB queries,
 * credentials, or owner UUIDs.
 */

import {
	HOST_LOGIN_ALIAS_MAX_LENGTH,
	HOST_LOGIN_ALIAS_PATTERN,
	isCanonicalHostLoginAlias,
} from '../../../src/lib/auth/login-alias.ts';

export interface InvitationAssetSpec {
	key: string;
	relativePath: string;
	displayName: string;
	alt: string;
	focalPoint?: {
		default?: string;
		mobile?: string;
		tablet?: string;
		desktop?: string;
	};
}

export interface UploadedAssetRef {
	type: 'uploaded';
	assetId: string;
	src: string;
}

export type UploadedAssetMap<K extends string = string> = Record<K, UploadedAssetRef>;

export interface InvitationEventTiming {
	localDateTime: string;
	timeZone: string;
	startsAtUtc: string;
}

export type InvitationLifecycle = 'in_progress' | 'published';
export type InvitationDeliveryScope = 'content-only' | 'content-and-assets' | 'assets-only';

/** Host Auth login local-part: `{alias}@clientes.celebra.invalid`. Independent of slug. */
export { HOST_LOGIN_ALIAS_MAX_LENGTH, HOST_LOGIN_ALIAS_PATTERN };

export interface InvitationDefinition<K extends string = string> {
	slug: string;
	createdAt: string;
	/** Explicit delivery lifecycle. Observability must never infer this from age or placement. */
	lifecycle: InvitationLifecycle;
	/** Maximum managed scope authorized by the canonical definition. */
	deliveryScope: InvitationDeliveryScope;
	eventType: string;
	title: string;
	clientName: string;
	/** Dedicated host Auth login alias (not derived from slug). */
	hostLoginAlias: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	photosReceived?: boolean;
	baseDemoId: string;
	themeId: string;
	visualProfileId: string;
	eventTiming: InvitationEventTiming;
	assetDir?: string;
	assets: readonly InvitationAssetSpec[];
	buildPublishedContent(assets: UploadedAssetMap<K>): Record<string, unknown>;
}

export function getInvitationAssetSourceDir(definition: InvitationDefinition): string {
	return definition.assetDir ?? `src/assets/invitations/${definition.slug}`;
}

function validateAssetKeys(assets: readonly InvitationAssetSpec[]): void {
	const assetKeys = new Set<string>();
	for (const asset of assets) {
		if (!asset.key || assetKeys.has(asset.key)) {
			throw new Error('Invitation definition asset keys must be non-empty and unique.');
		}
		assetKeys.add(asset.key);
		if (
			!asset.relativePath ||
			/^(?:[a-z]:)?[\\\\/]/i.test(asset.relativePath) ||
			asset.relativePath.split(/[\\\\/]/).includes('..')
		) {
			throw new Error(
				`Invitation asset "${asset.key}" must use a relative path within the asset root.`,
			);
		}
	}
}

/**
 * Type-safe helper for defining single-file invitations.
 */
export function defineInvitation<K extends string = string>(
	definition: InvitationDefinition<K>,
): InvitationDefinition<K> {
	if (!definition.slug || typeof definition.slug !== 'string') {
		throw new Error('Invitation definition requires a non-empty string slug.');
	}
	if (
		!definition.hostLoginAlias ||
		typeof definition.hostLoginAlias !== 'string' ||
		!isCanonicalHostLoginAlias(definition.hostLoginAlias)
	) {
		throw new Error(
			'Invitation definition requires canonical hostLoginAlias: lowercase [a-z0-9_] segments, 3-60 chars.',
		);
	}
	if (!definition.eventType || typeof definition.eventType !== 'string') {
		throw new Error('Invitation definition requires a non-empty string eventType.');
	}
	if (!definition.title || typeof definition.title !== 'string') {
		throw new Error('Invitation definition requires a non-empty string title.');
	}
	if (!Number.isFinite(Date.parse(definition.createdAt)) || !definition.createdAt.endsWith('Z')) {
		throw new Error('Invitation definition requires a canonical UTC createdAt timestamp.');
	}
	if (definition.lifecycle !== 'in_progress' && definition.lifecycle !== 'published') {
		throw new Error('Invitation definition requires an explicit lifecycle.');
	}
	if (
		definition.deliveryScope !== 'content-only' &&
		definition.deliveryScope !== 'content-and-assets' &&
		definition.deliveryScope !== 'assets-only'
	) {
		throw new Error('Invitation definition requires an explicit managed delivery scope.');
	}
	if (!Array.isArray(definition.assets)) {
		throw new Error('Invitation definition requires an assets array.');
	}
	validateAssetKeys(definition.assets);
	if (typeof definition.buildPublishedContent !== 'function') {
		throw new Error('Invitation definition requires a buildPublishedContent function.');
	}
	const semanticAssets = Object.fromEntries(
		definition.assets.map((asset) => [
			asset.key,
			{
				type: 'uploaded' as const,
				assetId: `__INVITATION_ASSET_KEY__:${asset.key}`,
				src: `__STORAGE_URL__/__INVITATION_ASSET_KEY__:${asset.key}`,
			},
		]),
	) as UploadedAssetMap<K>;
	const assertSemanticAssetRefs = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(assertSemanticAssetRefs);
			return;
		}
		if (!value || typeof value !== 'object') return;
		const record = value as Record<string, unknown>;
		if (record.type === 'uploaded') {
			const assetId = record.assetId;
			const key =
				typeof assetId === 'string' ? assetId.replace('__INVITATION_ASSET_KEY__:', '') : '';
			const expected = (semanticAssets as UploadedAssetMap)[key];
			if (!expected || record.assetId !== expected.assetId || record.src !== expected.src) {
				throw new Error(
					'Invitation content must reference declared assets by semantic key, never environment-local IDs or URLs.',
				);
			}
		}
		Object.values(record).forEach(assertSemanticAssetRefs);
	};
	assertSemanticAssetRefs(definition.buildPublishedContent(semanticAssets));
	return definition;
}
