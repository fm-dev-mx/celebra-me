/**
 * content-parity.ts — Read-only semantic invitation content parity across environments.
 *
 * Reuses promotion-comparison canonicalization. Never loads or compares RSVP/PII tables.
 * See docs/core/content-parity-rsvp-isolation.md.
 */

import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES } from '../db/db-target-config.ts';
import { canonicalizeValue, isSemanticallyEqual } from './promotion-comparison.ts';

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
	for (const [entity, field, l, r, detail] of checks) {
		if (!isSemanticallyEqual(l, r)) {
			push(entity, field, canonicalizeValue(l), canonicalizeValue(r), detail);
		}
	}
}

function compareAssets(
	left: SemanticInvitationSnapshot,
	right: SemanticInvitationSnapshot,
	push: DriftPush,
): void {
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

function toAssetDigests(
	assets: Array<{
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
	}>,
): SemanticAssetDigest[] {
	const digests: SemanticAssetDigest[] = [];
	for (const asset of assets) {
		const semanticKey = String(asset.managed_source_key || asset.display_name || '').trim();
		const sha256 = String(asset.sha256 || '').trim();
		if (semanticKey && sha256) digests.push({ semanticKey, sha256 });
	}
	return sortedAssets(digests);
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
		managed_source_key?: string | null;
		display_name?: string | null;
		sha256?: string | null;
	}>;
	event?: { slug?: string; event_type?: string } | null;
}): SemanticInvitationSnapshot {
	const isDemo = input.published?.is_demo === true || input.invitation.kind === 'demo';
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
		assets: toAssetDigests(input.assets ?? []),
		eventProjection: toEventProjection(isDemo, input.invitation, input.event),
	};
}
