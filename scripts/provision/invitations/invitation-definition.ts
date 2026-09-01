/**
 * invitation-definition.ts — Single-File Invitation Definition Contract
 *
 * Defines the standard typed interface and helper for versioned, single-file
 * invitation definitions in Celebra-me.
 *
 * Invitation definitions contain content structure, asset metadata, timing,
 * and location data, but do NOT contain environment settings, DB queries,
 * credentials, or external owner UUIDs.
 */

import { isCanonicalHostLoginAlias } from '../../../src/lib/auth/login-alias.ts';
import type { ImageOptimizationRole } from '../../../src/lib/invitation-preparation/image-optimization.ts';
import { eventContentSchema } from '../../../src/lib/schemas/content/base-event.schema.ts';

export interface InvitationAssetSpec {
	key: string;
	relativePath: string;
	displayName: string;
	alt: string;
	optimizationRole?: ImageOptimizationRole;
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
export type ManagedIdentityProvenance = 'persisted' | 'owner-approved';

const MANAGED_IDENTITY_UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface InvitationDefinition<K extends string = string> {
	slug: string;
	/**
	 * Immutable managed invitation identity (UUID v4). Independent of slug, title, and client_name.
	 * Never reuse across definitions; never change after first publication.
	 */
	managedIdentityId: string;
	/**
	 * Owner-approved definitions carry a fixed UUID until a target-environment preflight verifies the
	 * corresponding persisted row. They remain in_progress and cannot be released before verification.
	 */
	managedIdentityProvenance: ManagedIdentityProvenance;
	/**
	 * Historical slugs previously used by this managed identity. Used for alias diagnostics and
	 * REKEY_REQUIRED protection — never for silent create/upsert identity inference.
	 */
	previousSlugs?: readonly string[];
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

/** Public routes are /{eventType}/{slug}; never repeat eventType inside the slug. */
function assertSlugDoesNotRepeatEventType(slug: string, eventType: string): void {
	const eventTypePrefix = `${eventType}-`;
	if (slug === eventType || slug.startsWith(eventTypePrefix)) {
		throw new Error(
			`Invitation slug "${slug}" must not include eventType "${eventType}" ` +
				`(URL is already /${eventType}/{slug}).`,
		);
	}
}

function validatePreviousSlugs(slug: string, previousSlugs: readonly string[]): void {
	const seenPrevious = new Set<string>();
	for (const previousSlug of previousSlugs) {
		if (!previousSlug || typeof previousSlug !== 'string') {
			throw new Error('Invitation previousSlugs entries must be non-empty strings.');
		}
		if (previousSlug === slug) {
			throw new Error(
				`Invitation previousSlugs must not include the current slug "${slug}".`,
			);
		}
		if (seenPrevious.has(previousSlug)) {
			throw new Error(`Invitation previousSlugs contains duplicate "${previousSlug}".`);
		}
		seenPrevious.add(previousSlug);
	}
}

function validateManagedIdentity<K extends string>(definition: InvitationDefinition<K>): void {
	if (
		!definition.managedIdentityId ||
		typeof definition.managedIdentityId !== 'string' ||
		!MANAGED_IDENTITY_UUID_RE.test(definition.managedIdentityId)
	) {
		throw new Error(
			'Invitation definition requires managedIdentityId as an immutable UUID v4, independent of slug.',
		);
	}
	if (
		definition.managedIdentityProvenance !== 'persisted' &&
		definition.managedIdentityProvenance !== 'owner-approved'
	) {
		throw new Error('Invitation definition has an invalid managedIdentityProvenance.');
	}
	if (
		definition.lifecycle === 'published' &&
		definition.managedIdentityProvenance !== 'persisted'
	) {
		throw new Error(
			'Published invitation definitions require a persisted managed identity provenance.',
		);
	}
	if (
		definition.managedIdentityProvenance === 'owner-approved' &&
		definition.lifecycle !== 'in_progress'
	) {
		throw new Error(
			'Owner-approved invitation definitions must remain in_progress until environment cutover.',
		);
	}
}

function validateEventTiming<K extends string>(definition: InvitationDefinition<K>): void {
	const timing = definition.eventTiming;
	if (
		!timing ||
		typeof timing !== 'object' ||
		typeof timing.localDateTime !== 'string' ||
		typeof timing.timeZone !== 'string' ||
		typeof timing.startsAtUtc !== 'string'
	) {
		throw new Error('Invitation definition requires an explicit eventTiming object.');
	}
	if (
		definition.lifecycle === 'published' &&
		(!timing.localDateTime || !timing.timeZone || !timing.startsAtUtc)
	) {
		throw new Error('Published invitation definitions require complete eventTiming values.');
	}
}

function validateInvitationMetadata<K extends string>(definition: InvitationDefinition<K>): void {
	if (!definition.slug || typeof definition.slug !== 'string') {
		throw new Error('Invitation definition requires a non-empty string slug.');
	}
	validateManagedIdentity(definition);
	validateEventTiming(definition);
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
	assertSlugDoesNotRepeatEventType(definition.slug, definition.eventType);
	validatePreviousSlugs(definition.slug, definition.previousSlugs ?? []);
	if (!definition.title || typeof definition.title !== 'string') {
		throw new Error('Invitation definition requires a non-empty string title.');
	}
	if (!Number.isFinite(Date.parse(definition.createdAt)) || !definition.createdAt.endsWith('Z')) {
		throw new Error('Invitation definition requires a canonical UTC createdAt timestamp.');
	}
}

function validateInvitationStructure<K extends string>(definition: InvitationDefinition<K>): void {
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
}

/**
 * Type-safe helper for defining single-file invitations.
 */
export function defineInvitation<K extends string = string>(
	definition: InvitationDefinition<K>,
): InvitationDefinition<K> {
	validateInvitationMetadata(definition);
	validateInvitationStructure(definition);
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
	const semanticContent = definition.buildPublishedContent(semanticAssets);
	assertSemanticAssetRefs(semanticContent);
	const parsed = eventContentSchema.safeParse(semanticContent);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
			.join('; ');
		throw new Error(
			`Invitation definition does not satisfy the canonical content contract: ${issues}`,
		);
	}
	return definition;
}
