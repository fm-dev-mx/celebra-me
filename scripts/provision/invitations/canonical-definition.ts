/** Shared constructor for managed invitations with canonical semantic assets. */
import type { CanonicalEventContentInput } from '../../../src/lib/schemas/content/base-event.schema.ts';
import {
	defineInvitation,
	type InvitationAssetSpec,
	type InvitationDefinition,
	type UploadedAssetMap,
} from './invitation-definition.ts';

export interface CanonicalInvitationOptions {
	slug: string;
	eventType: string;
	title: string;
	baseDemoId: string;
	themeId: string;
	visualProfileId: string;
	eventTiming: { localDateTime: string; timeZone: string; startsAtUtc: string };
	content: CanonicalEventContentInput;
	managedIdentityId: string;
	managedIdentityProvenance: 'persisted' | 'owner-approved';
	hostLoginAlias: string;
	clientName?: string;
	assetDir: string;
	assetFiles: Readonly<Record<string, string>>;
	lifecycle?: InvitationDefinition['lifecycle'];
	deliveryScope?: InvitationDefinition['deliveryScope'];
}

function toAssetSpecs(
	title: string,
	assetFiles: Readonly<Record<string, string>>,
): readonly InvitationAssetSpec[] {
	return Object.entries(assetFiles).map(([key, relativePath]) => ({
		key,
		relativePath,
		displayName: `${title} — ${key}`,
		alt: `${title} — ${key}`,
	}));
}

function canonicalizeAssetReferences(
	value: unknown,
	assets: UploadedAssetMap,
	assetKeys: ReadonlySet<string>,
	allowSemanticReference = false,
): unknown {
	if (typeof value === 'string') {
		return allowSemanticReference && assetKeys.has(value) ? assets[value] : value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => canonicalizeAssetReferences(item, assets, assetKeys));
	}
	if (!value || typeof value !== 'object') return value;

	const record = value as Record<string, unknown>;
	if (record.type === 'internal') {
		if (typeof record.key !== 'string' || !assetKeys.has(record.key)) {
			throw new Error(`Canonical asset key is undeclared: ${String(record.key)}`);
		}
		return assets[record.key];
	}
	if (record.type === 'uploaded') {
		throw new Error(
			'Canonical invitation content must not contain uploaded asset IDs or URLs. Use a semantic asset key.',
		);
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, child]) => [
			key,
			canonicalizeAssetReferences(
				child,
				assets,
				assetKeys,
				ASSET_REFERENCE_FIELDS.has(key),
			),
		]),
	);
}

const ASSET_REFERENCE_FIELDS = new Set([
	'backgroundImage',
	'backgroundImageMobile',
	'backgroundImageDesktop',
	'featuredImage',
	'image',
	'ogImage',
	'portrait',
]);

export function defineCanonicalInvitation(
	options: CanonicalInvitationOptions,
): InvitationDefinition {
	const assetKeys = new Set(Object.keys(options.assetFiles));
	return defineInvitation({
		slug: options.slug,
		managedIdentityId: options.managedIdentityId,
		managedIdentityProvenance: options.managedIdentityProvenance,
		createdAt: '2026-08-29T00:00:00.000Z',
		lifecycle: options.lifecycle ?? 'in_progress',
		deliveryScope: options.deliveryScope ?? 'content-only',
		eventType: options.eventType,
		title: options.title,
		clientName: options.clientName ?? options.title,
		hostLoginAlias: options.hostLoginAlias,
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: true,
		baseDemoId: options.baseDemoId,
		themeId: options.themeId,
		visualProfileId: options.visualProfileId,
		eventTiming: options.eventTiming,
		assetDir: options.assetDir,
		assets: toAssetSpecs(options.title, options.assetFiles),
		buildPublishedContent(assetMap) {
			const published = canonicalizeAssetReferences(
				options.content,
				assetMap,
				assetKeys,
			) as Record<string, unknown>;
			if (options.visualProfileId && !published.visualProfileId) {
				published.visualProfileId = options.visualProfileId;
			}
			return published;
		},
	});
}
