/**
 * Canonical source adapter for invitations whose approved public content was
 * previously stored only as a sanitized render fixture.
 *
 * The fixture is content input, not a runtime compatibility path. All output
 * is converted to the same semantic asset references and validated by
 * defineInvitation like every other managed definition.
 */
import { createHash } from 'node:crypto';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';
import {
	defineInvitation,
	type InvitationAssetSpec,
	type InvitationDefinition,
	type UploadedAssetMap,
} from './invitation-definition.ts';

type FixtureAssetValue = {
	type?: string;
	key?: unknown;
	assetId?: unknown;
	[key: string]: unknown;
};

export interface FixtureInvitationOptions {
	fixture: LocalRenderCorpusFixture;
	managedIdentityId: string;
	managedIdentityProvenance?: 'persisted' | 'authoring-placeholder';
	hostLoginAlias: string;
	clientName?: string;
	assetDir: string;
	assetFiles: Readonly<Record<string, string>>;
	assetIdToKey?: Readonly<Record<string, string>>;
	lifecycle?: InvitationDefinition['lifecycle'];
	deliveryScope?: InvitationDefinition['deliveryScope'];
}

/** Stable UUID v4-shaped identity for a previously unmanaged invitation row. */
export function deriveFixtureManagedIdentityId(slug: string): string {
	const hex = createHash('sha256').update(`celebra-me:managed-invitation:${slug}`).digest('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function assetDisplayName(fixture: LocalRenderCorpusFixture, key: string): string {
	return `${fixture.title} — ${key}`;
}

function assetAltText(fixture: LocalRenderCorpusFixture, key: string): string {
	return `${fixture.title} — ${key}`;
}

const ASSET_FIELD_NAMES = new Set([
	'image',
	'backgroundImage',
	'backgroundImageMobile',
	'backgroundImageDesktop',
	'featuredImage',
	'portrait',
	'ogImage',
]);

function toAssetSpecs(
	fixture: LocalRenderCorpusFixture,
	assetFiles: Readonly<Record<string, string>>,
): readonly InvitationAssetSpec[] {
	return Object.entries(assetFiles).map(([key, relativePath]) => ({
		key,
		relativePath,
		displayName: assetDisplayName(fixture, key),
		alt: assetAltText(fixture, key),
	}));
}

function canonicalizeStringAsset(
	value: string,
	assets: UploadedAssetMap,
	assetKeys: ReadonlySet<string>,
	fieldName: string | undefined,
	pathKey: string,
): unknown {
	if (!fieldName || !ASSET_FIELD_NAMES.has(fieldName)) return value;
	const interludeMatch = pathKey.match(/^interludes\[(\d+)\]\.image$/u);
	if (interludeMatch) {
		const interludeKey = `interlude${String(Number(interludeMatch[1]) + 1).padStart(2, '0')}`;
		if (assetKeys.has(interludeKey)) return assets[interludeKey];
	}
	if (pathKey === 'hero.backgroundImageMobile' && assetKeys.has('heroMobile')) {
		return assets.heroMobile;
	}
	return assetKeys.has(value) ? assets[value] : value;
}

function canonicalizeAssetReferences(
	value: unknown,
	assets: UploadedAssetMap,
	assetKeys: ReadonlySet<string>,
	assetIdToKey: Readonly<Record<string, string>>,
	fieldName?: string,
	pathKey = '',
): unknown {
	if (typeof value === 'string') {
		return canonicalizeStringAsset(value, assets, assetKeys, fieldName, pathKey);
	}
	if (Array.isArray(value)) {
		return value.map((item, index) =>
			canonicalizeAssetReferences(item, assets, assetKeys, assetIdToKey, fieldName, `${pathKey}[${index}]`),
		);
	}
	if (!value || typeof value !== 'object') return value;

	const record = value as FixtureAssetValue;
	if (pathKey === 'hero.backgroundImageMobile' && assetKeys.has('heroMobile')) {
		if (record.type === 'uploaded' || record.type === 'internal') return assets.heroMobile;
	}
	if (record.type === 'internal' && typeof record.key === 'string') {
		if (!assetKeys.has(record.key)) {
			throw new Error(`Canonical fixture asset key is undeclared: ${record.key}`);
		}
		return assets[record.key];
	}
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		const key = assetIdToKey[record.assetId];
		if (!key || !assetKeys.has(key)) {
			throw new Error(
				`Canonical fixture uploaded asset ${record.assetId} has no declared semantic key.`,
			);
		}
		return assets[key];
	}

	return Object.fromEntries(
		Object.entries(record).map(([key, child]) => [
			key,
			canonicalizeAssetReferences(child, assets, assetKeys, assetIdToKey, key, pathKey ? `${pathKey}.${key}` : key),
		]),
	);
}

export function defineFixtureBackedInvitation(
	options: FixtureInvitationOptions,
): InvitationDefinition {
	const { fixture } = options;
	const assetKeys = new Set(Object.keys(options.assetFiles));
	const assets = toAssetSpecs(fixture, options.assetFiles);
	const content = fixture.publishedContent;
	const visualProfileId =
		typeof content.visualProfileId === 'string' && content.visualProfileId
			? content.visualProfileId
			: fixture.slug;
	const themeId =
		content.theme && typeof content.theme === 'object' &&
		typeof (content.theme as Record<string, unknown>).preset === 'string'
			? String((content.theme as Record<string, unknown>).preset)
			: fixture.themeId;
	const eventTiming = content.eventTiming;
	const canonicalTiming = eventTiming && typeof eventTiming === 'object'
		? eventTiming as Record<string, unknown>
		: undefined;

	return defineInvitation({
		slug: fixture.slug,
		managedIdentityId: options.managedIdentityId,
		managedIdentityProvenance: options.managedIdentityProvenance ?? 'authoring-placeholder',
		createdAt: '2026-08-29T00:00:00.000Z',
		// These definitions are canonical sources, but remain in_progress until
		// their separately authorized persisted rows are reconciled.
		lifecycle: options.lifecycle ?? 'in_progress',
		deliveryScope: options.deliveryScope ?? 'content-only',
		eventType: fixture.eventType,
		title: fixture.title,
		clientName: options.clientName ?? fixture.title,
		hostLoginAlias: options.hostLoginAlias,
		clientEmail: '',
		clientWhatsapp: '',
		photosReceived: true,
		baseDemoId: fixture.baseDemoId,
		themeId,
		visualProfileId,
		eventTiming: {
			localDateTime: String(canonicalTiming?.localDateTime ?? ''),
			timeZone: String(canonicalTiming?.timeZone ?? ''),
			startsAtUtc: String(canonicalTiming?.startsAtUtc ?? ''),
		},
		assetDir: options.assetDir,
		assets,
		buildPublishedContent(assetMap) {
			return canonicalizeAssetReferences(
				content,
				assetMap,
				assetKeys,
				options.assetIdToKey ?? {},
			) as Record<string, unknown>;
		},
	});
}
