/**
 * content-parity.ts — Read-only semantic invitation content parity across environments.
 *
 * Reuses promotion-comparison canonicalization. Never loads or compares RSVP/PII tables.
 * See docs/core/content-parity-rsvp-isolation.md.
 */

import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES } from '../db/db-target-config.ts';
import {
	areEquivalentAssetRepresentations,
	canonicalizeManagedInvitationContent,
	canonicalizeValue,
	isSemanticallyEqual,
	rewriteUploadedAssetReferences,
	semanticInvitationContentEqual,
} from './promotion-comparison.ts';
import { ASSET_KEY_PREFIX } from './normalized-invitation-release.ts';

export type ContentParityEnvironment = 'local' | 'preview' | 'production';

/** Tables that must never enter parity or mirror comparison scope. */
export const CONTENT_PARITY_EXCLUDED_TABLES = EXCLUDED_TABLES;

export { CONTENT_MIRROR_TABLES };

/** True when an entity/table name is forbidden in parity scope. */
export function isExcludedFromContentParity(entity: string): boolean {
	const normalized = entity.trim().toLowerCase();
	return CONTENT_PARITY_EXCLUDED_TABLES.some(
		(table) => normalized === table || normalized.startsWith(`${table}.`),
	);
}

export interface SemanticAssetDigest {
	/** managed_source_key or display_name fallback — semantic identity, not UUID */
	semanticKey: string;
	sha256: string;
}

export interface SemanticEventProjection {
	slug: string;
	eventType: string;
	/** True when a non-deleted events row is linked for this invitation. */
	hasLinkedEvent: boolean;
}

/**
 * Environment-agnostic invitation-facing snapshot used for semantic compare.
 * Intentionally omits IDs, owners, timestamps, versions, receipts, and RSVP children.
 */
export interface SemanticInvitationSnapshot {
	slug: string;
	eventType: string;
	kind: string;
	baseDemoId: string | null;
	themeId: string | null;
	snapshot: unknown;
	draftContent: unknown | null;
	publishedContent: unknown | null;
	isDemo: boolean;
	assets: SemanticAssetDigest[];
	assetIdToKey: Record<string, string>;
	eventProjection: SemanticEventProjection | null;
	identityConflict?: boolean;
	matchingIds?: string[];
}

export interface ContentParityDrift {
	entity: string;
	field: string;
	environments: [ContentParityEnvironment, ContentParityEnvironment];
	left: unknown;
	right: unknown;
	detail: string;
}

export interface ContentParityCompareResult {
	slug: string;
	eventType: string;
	environments: ContentParityEnvironment[];
	drifts: ContentParityDrift[];
	ok: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUploadedAssetReference(
	value: unknown,
): value is Record<string, unknown> & { type: 'uploaded'; assetId: string } {
	return isRecord(value) && value.type === 'uploaded' && typeof value.assetId === 'string';
}

function joinSemanticPath(parent: string, child: string | number): string {
	if (typeof child === 'number') return `${parent}[${child}]`;
	return parent ? `${parent}.${child}` : child;
}

/** Lists normalized semantic paths only; it deliberately never returns field values. */
export function listSemanticDifferencePaths(left: unknown, right: unknown): string[] {
	const walk = (currentLeft: unknown, currentRight: unknown, path: string): string[] => {
		if (areEquivalentAssetRepresentations(currentLeft, currentRight)) return [];
		if (isSemanticallyEqual(currentLeft, currentRight)) return [];
		if (isUploadedAssetReference(currentLeft) && isUploadedAssetReference(currentRight)) {
			return currentLeft.assetId === currentRight.assetId ? [] : [path || '$'];
		}
		if (Array.isArray(currentLeft) && Array.isArray(currentRight)) {
			if (currentLeft.length !== currentRight.length) return [path || '$'];
			return currentLeft.flatMap((item, index) =>
				walk(item, currentRight[index], joinSemanticPath(path, index)),
			);
		}
		if (isRecord(currentLeft) && isRecord(currentRight)) {
			const keys = new Set([...Object.keys(currentLeft), ...Object.keys(currentRight)]);
			return [...keys]
				.sort()
				.flatMap((key) =>
					walk(currentLeft[key], currentRight[key], joinSemanticPath(path, key)),
				);
		}
		return [path || '$'];
	};

	return walk(
		canonicalizeManagedInvitationContent(left),
		canonicalizeManagedInvitationContent(right),
		'',
	);
}

type DriftPush = (
	entity: string,
	field: string,
	left: unknown,
	right: unknown,
	detail: string,
) => void;

function sortedAssets(assets: SemanticAssetDigest[]): SemanticAssetDigest[] {
	return [...assets].sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));
}

function assertNoExcludedEntity(entity: string): void {
	if (isExcludedFromContentParity(entity)) {
		throw new Error(
			`Content parity must not compare excluded operational/PII entity "${entity}".`,
		);
	}
}

function compareScalarFields(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	const fields: Array<[keyof SemanticInvitationSnapshot, string]> = [
		['slug', 'Route slug mismatch'],
		['eventType', 'Event type mismatch'],
		['kind', 'Invitation kind mismatch'],
		['baseDemoId', 'Base demo mismatch'],
		['themeId', 'Theme mismatch'],
		['isDemo', 'Demo flag mismatch'],
	];
	for (const [field, detail] of fields) {
		if (left[field] !== right[field]) {
			push('invitation', field, left[field], right[field], detail);
		}
	}
}

function assetIdMap(snapshot: SemanticInvitationSnapshot): Map<string, string> {
	return new Map(Object.entries(snapshot.assetIdToKey ?? {}));
}

function canonicalContentValue(value: unknown, keyByAssetId: ReadonlyMap<string, string>): unknown {
	const rewritten = rewriteUploadedAssetReferences(value, keyByAssetId);
	return canonicalizeManagedInvitationContent(rewritten.ok ? rewritten.value : value);
}

function compareCanonicalContent(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	const checks: Array<[string, string, unknown, unknown, string]> = [
		[
			'invitation',
			'snapshot',
			left.snapshot,
			right.snapshot,
			'Invitation snapshot semantic drift',
		],
		[
			'invitation_content_drafts',
			'content',
			left.draftContent,
			right.draftContent,
			'Draft content semantic drift',
		],
		[
			'published_invitation_content',
			'content',
			left.publishedContent,
			right.publishedContent,
			'Published content semantic drift',
		],
	];
	const leftKeys = assetIdMap(left);
	const rightKeys = assetIdMap(right);
	for (const [entity, field, l, r, detail] of checks) {
		const equal =
			field === 'content'
				? semanticInvitationContentEqual(l, r, leftKeys, rightKeys)
				: isSemanticallyEqual(l, r);
		if (!equal) {
			push(
				entity,
				field,
				field === 'content' ? canonicalContentValue(l, leftKeys) : canonicalizeValue(l),
				field === 'content' ? canonicalContentValue(r, rightKeys) : canonicalizeValue(r),
				detail,
			);
		}
	}
}

function hasUploadedAssetReference(value: unknown): boolean {
	const ids = new Set<string>();
	collectUploadedAssetIds(value, ids);
	return ids.size > 0;
}

/**
 * Managed inventory + uploaded refs vs empty inventory + content-only external
 * refs (URL strings or bare semantic keys). Inventory shape is representation-owned.
 */
function areCompatibleAssetInventoryRepresentations(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
): boolean {
	const leftManaged = left.assets.length > 0;
	const rightManaged = right.assets.length > 0;
	if (leftManaged === rightManaged) return false;

	const external = leftManaged ? right : left;
	const managed = leftManaged ? left : right;
	const externalContents = [external.draftContent, external.publishedContent];
	const managedContents = [managed.draftContent, managed.publishedContent];

	if (external.assets.length !== 0) return false;
	if (externalContents.some(hasUploadedAssetReference)) return false;
	if (!managedContents.some(hasUploadedAssetReference)) return false;
	return true;
}

function compareAssets(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	if (areCompatibleAssetInventoryRepresentations(left, right)) return;

	const leftAssets = sortedAssets(left.assets);
	const rightAssets = sortedAssets(right.assets);
	const leftKeys = leftAssets.map((a) => a.semanticKey);
	const rightKeys = rightAssets.map((a) => a.semanticKey);
	if (leftKeys.join('\0') !== rightKeys.join('\0')) {
		push(
			'invitation_assets',
			'semanticKeys',
			leftKeys,
			rightKeys,
			'Asset semantic key set drift',
		);
		return;
	}
	for (let i = 0; i < leftAssets.length; i += 1) {
		if (leftAssets[i].sha256 !== rightAssets[i].sha256) {
			push(
				'invitation_assets',
				`sha256:${leftAssets[i].semanticKey}`,
				leftAssets[i].sha256,
				rightAssets[i].sha256,
				`Asset digest drift for semantic key ${leftAssets[i].semanticKey}`,
			);
		}
	}
}

function linked(proj: SemanticEventProjection | null): boolean {
	return proj?.hasLinkedEvent === true;
}

function compareDemoEventProjection(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	if (!linked(left.eventProjection) && !linked(right.eventProjection)) return;
	push(
		'events',
		'hasLinkedEvent',
		linked(left.eventProjection),
		linked(right.eventProjection),
		'Demo invitations must not carry a persistent events row by default',
	);
}

function compareClientEventProjection(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	const lProj = left.eventProjection;
	const rProj = right.eventProjection;
	if (!linked(lProj) || !linked(rProj) || !lProj || !rProj) {
		push(
			'events',
			'hasLinkedEvent',
			linked(lProj),
			linked(rProj),
			'Published non-demo client invitation requires an environment-local events projection',
		);
		return;
	}
	if (lProj.slug === rProj.slug && lProj.eventType === rProj.eventType) return;
	push(
		'events',
		'route',
		{ slug: lProj.slug, eventType: lProj.eventType },
		{ slug: rProj.slug, eventType: rProj.eventType },
		'Event projection route identity drift',
	);
}

function compareEventProjection(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
	if (left.isDemo && right.isDemo) {
		compareDemoEventProjection(left, right, push);
		return;
	}
	compareClientEventProjection(left, right, push);
}

/**
 * Compare two semantic snapshots. Legitimate env identity/metadata differences are already
 * stripped from the snapshot shape; Storage hosts are canonicalized during compare.
 */
export function compareSemanticInvitationSnapshots(
	leftEnv: ContentParityEnvironment,
	left: SemanticInvitationSnapshot,
	rightEnv: ContentParityEnvironment,
	right: SemanticInvitationSnapshot,
): ContentParityDrift[] {
	const drifts: ContentParityDrift[] = [];
	const pair: [ContentParityEnvironment, ContentParityEnvironment] = [leftEnv, rightEnv];
	const push: DriftPush = (entity, field, l, r, detail) => {
		assertNoExcludedEntity(entity);
		drifts.push({ entity, field, environments: pair, left: l, right: r, detail });
	};

	if (left.identityConflict || right.identityConflict) {
		push(
			'invitation',
			'identity',
			left.matchingIds ?? (left.identityConflict ? 'IDENTITY_CONFLICT' : left.slug),
			right.matchingIds ?? (right.identityConflict ? 'IDENTITY_CONFLICT' : right.slug),
			'IDENTITY_CONFLICT: Multiple active invitation records exist for slug in target environment.',
		);
		return drifts;
	}

	compareScalarFields(left, right, push);
	compareCanonicalContent(left, right, push);
	compareAssets(left, right, push);
	compareEventProjection(left, right, push);
	return drifts;
}

export function compareAcrossEnvironments(
	slug: string,
	eventType: string,
	snapshots: Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>>,
): ContentParityCompareResult {
	const environments = (Object.keys(snapshots) as ContentParityEnvironment[]).filter(
		(env) => snapshots[env],
	);
	const drifts: ContentParityDrift[] = [];

	for (let i = 0; i < environments.length; i += 1) {
		for (let j = i + 1; j < environments.length; j += 1) {
			const leftEnv = environments[i];
			const rightEnv = environments[j];
			const left = snapshots[leftEnv];
			const right = snapshots[rightEnv];
			if (!left || !right) continue;
			drifts.push(...compareSemanticInvitationSnapshots(leftEnv, left, rightEnv, right));
		}
	}

	return {
		slug,
		eventType,
		environments,
		drifts,
		ok: drifts.length === 0,
	};
}

function collectUploadedAssetIds(value: unknown, into: Set<string>): void {
	if (Array.isArray(value)) {
		for (const item of value) collectUploadedAssetIds(item, into);
		return;
	}
	if (isUploadedAssetReference(value)) {
		into.add(value.assetId);
		return;
	}
	if (!isRecord(value)) return;
	for (const child of Object.values(value)) collectUploadedAssetIds(child, into);
}

function referencedSemanticKeys(
	values: unknown[],
	idToKey: Record<string, string>,
): Set<string> | null {
	const ids = new Set<string>();
	for (const value of values) collectUploadedAssetIds(value, ids);
	if (ids.size === 0) return null;
	const keys = new Set<string>();
	for (const assetId of ids) {
		if (assetId.startsWith(ASSET_KEY_PREFIX)) {
			keys.add(assetId.slice(ASSET_KEY_PREFIX.length));
			continue;
		}
		const key = idToKey[assetId];
		if (key) keys.add(key);
	}
	return keys;
}

function toAssetDigests(
	assets: Array<{
		id?: string | null;
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
	}>,
	referencedKeys: Set<string> | null,
): SemanticAssetDigest[] {
	const digests: SemanticAssetDigest[] = [];
	for (const asset of assets) {
		const semanticKey = String(asset.managed_source_key || asset.display_name || '').trim();
		const sha256 = String(asset.sha256 || '').trim();
		if (!semanticKey || !sha256) continue;
		if (referencedKeys && !referencedKeys.has(semanticKey)) continue;
		digests.push({ semanticKey, sha256 });
	}
	return sortedAssets(digests);
}

function toAssetIdToKey(
	assets: Array<{
		id?: string | null;
		managed_source_key?: string | null;
	}>,
): Record<string, string> {
	const map: Record<string, string> = {};
	for (const asset of assets) {
		const id = String(asset.id || '').trim();
		const key = String(asset.managed_source_key || '').trim();
		if (id && key) map[id] = key;
	}
	return map;
}

function toEventProjection(
	isDemo: boolean,
	invitation: { slug: string; event_type: string },
	event?: { slug?: string; event_type?: string } | null,
): SemanticEventProjection | null {
	const hasLinkedEvent = Boolean(event?.slug && event?.event_type);
	if (isDemo) {
		return hasLinkedEvent
			? {
					slug: String(event?.slug),
					eventType: String(event?.event_type),
					hasLinkedEvent: true,
				}
			: null;
	}
	return {
		slug: String(event?.slug ?? invitation.slug),
		eventType: String(event?.event_type ?? invitation.event_type),
		hasLinkedEvent,
	};
}

/**
 * Build a semantic snapshot from raw DB-shaped rows. Strips env-local identity fields.
 * Callers must not pass guest/claim/auth/intake rows.
 */
export function buildSemanticInvitationSnapshot(input: {
	invitation: {
		slug: string;
		event_type: string;
		kind: string;
		base_demo_id?: string | null;
		theme_id?: string | null;
		snapshot?: unknown;
	};
	draftContent?: unknown | null;
	published?: {
		content?: unknown;
		is_demo?: boolean;
		slug?: string;
		event_type?: string;
	} | null;
	assets?: Array<{
		id?: string | null;
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
	}>;
	event?: { slug?: string; event_type?: string } | null;
}): SemanticInvitationSnapshot {
	const isDemo = input.published?.is_demo === true || input.invitation.kind === 'demo';
	const assetIdToKey = toAssetIdToKey(input.assets ?? []);
	const hasAssetIds = (input.assets ?? []).some((asset) => String(asset.id || '').trim());
	const referencedKeys = hasAssetIds
		? (referencedSemanticKeys(
				[input.draftContent ?? null, input.published?.content ?? null],
				assetIdToKey,
			) ?? new Set<string>())
		: null;
	return {
		slug: input.invitation.slug,
		eventType: input.invitation.event_type,
		kind: input.invitation.kind,
		baseDemoId: input.invitation.base_demo_id ?? null,
		themeId: input.invitation.theme_id ?? null,
		snapshot: input.invitation.snapshot ?? null,
		draftContent: input.draftContent ?? null,
		publishedContent: input.published?.content ?? null,
		isDemo,
		assets: toAssetDigests(input.assets ?? [], referencedKeys),
		assetIdToKey,
		eventProjection: toEventProjection(isDemo, input.invitation, input.event),
	};
}
