/** Canonical source adapter for managed invitations. */
import {
  defineInvitation,
  type InvitationAssetSpec,
  type InvitationDefinition,
  type UploadedAssetMap,
} from './invitation-definition.ts';

type AssetValue = { type?: string; key?: unknown; assetId?: unknown; [key: string]: unknown };

export interface CanonicalInvitationOptions {
  slug: string;
  eventType: string;
  title: string;
  baseDemoId: string;
  themeId: string;
  visualProfileId: string;
  eventTiming: { localDateTime: string; timeZone: string; startsAtUtc: string };
  content: Record<string, unknown>;
  managedIdentityId: string;
  managedIdentityProvenance: 'persisted' | 'owner-approved';
  hostLoginAlias: string;
  clientName?: string;
  assetDir: string;
  assetFiles: Readonly<Record<string, string>>;
  assetIdToKey?: Readonly<Record<string, string>>;
  lifecycle?: InvitationDefinition['lifecycle'];
  deliveryScope?: InvitationDefinition['deliveryScope'];
}

function toAssetSpecs(title: string, assetFiles: Readonly<Record<string, string>>): readonly InvitationAssetSpec[] {
  return Object.entries(assetFiles).map(([key, relativePath]) => ({
    key,
    relativePath,
    displayName: `${title} — ${key}`,
    alt: `${title} — ${key}`,
  }));
}

const ASSET_FIELD_NAMES = new Set([
  'image', 'backgroundImage', 'backgroundImageMobile', 'backgroundImageDesktop',
  'featuredImage', 'portrait', 'ogImage',
]);

function canonicalizeStringAsset(value: string, assets: UploadedAssetMap, assetKeys: ReadonlySet<string>, fieldName: string | undefined, pathKey: string): unknown {
  if (!fieldName || !ASSET_FIELD_NAMES.has(fieldName)) return value;
  const interludeMatch = pathKey.match(/^interludes\[(\d+)\]\.image$/u);
  if (interludeMatch) {
    const interludeKey = `interlude${String(Number(interludeMatch[1]) + 1).padStart(2, '0')}`;
    if (assetKeys.has(interludeKey)) return assets[interludeKey];
  }
  if (pathKey === 'hero.backgroundImageMobile' && assetKeys.has('heroMobile')) return assets.heroMobile;
  return assetKeys.has(value) ? assets[value] : value;
}

function canonicalizeAssetReferences(value: unknown, assets: UploadedAssetMap, assetKeys: ReadonlySet<string>, assetIdToKey: Readonly<Record<string, string>>, fieldName?: string, pathKey = ''): unknown {
  if (typeof value === 'string') return canonicalizeStringAsset(value, assets, assetKeys, fieldName, pathKey);
  if (Array.isArray(value)) return value.map((item, index) => canonicalizeAssetReferences(item, assets, assetKeys, assetIdToKey, fieldName, `${pathKey}[${index}]`));
  if (!value || typeof value !== 'object') return value;
  const record = value as AssetValue;
  if (pathKey === 'hero.backgroundImageMobile' && assetKeys.has('heroMobile') && (record.type === 'uploaded' || record.type === 'internal')) return assets.heroMobile;
  if (record.type === 'internal' && typeof record.key === 'string') {
    if (!assetKeys.has(record.key)) throw new Error(`Canonical asset key is undeclared: ${record.key}`);
    return assets[record.key];
  }
  if (record.type === 'uploaded' && typeof record.assetId === 'string') {
    const key = assetIdToKey[record.assetId];
    if (!key || !assetKeys.has(key)) throw new Error(`Canonical uploaded asset ${record.assetId} has no declared semantic key.`);
    return assets[key];
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [
    key,
    canonicalizeAssetReferences(child, assets, assetKeys, assetIdToKey, key, pathKey ? `${pathKey}.${key}` : key),
  ]));
}

export function defineCanonicalInvitation(options: CanonicalInvitationOptions): InvitationDefinition {
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
      return canonicalizeAssetReferences(options.content, assetMap, assetKeys, options.assetIdToKey ?? {}) as Record<string, unknown>;
    },
  });
}
