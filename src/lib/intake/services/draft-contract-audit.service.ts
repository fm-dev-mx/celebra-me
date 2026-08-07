/**
 * Read-only detection of persisted Draft documents that violate the canonical
 * flat Draft contract. Does not rewrite data.
 */
import { InvitationContentDraftContentSchema } from '@/lib/intake/schemas/invitation-content-draft.schema';
import {
	canonicalizeDraftContent,
	type DraftNormalizationIssue,
} from '@/lib/intake/services/draft-content-mapper';
import { isRecord } from '@/lib/shared/data-utils';

export type DraftContractViolationKind =
	| 'published_only_field'
	| 'nested_family_structure'
	| 'schema_invalid'
	| 'normalization_unsupported'
	| 'hybrid_shape';

export interface DraftContractViolation {
	kind: DraftContractViolationKind;
	path: string;
	detail: string;
}

export interface DraftContractAuditResult {
	canonical: boolean;
	violations: DraftContractViolation[];
	normalizationIssues: DraftNormalizationIssue[];
	removedPublishedOnlyKeys: string[];
}

const NESTED_FAMILY_MARKERS: ReadonlyArray<{ path: string; test: (family: Record<string, unknown>) => boolean }> =
	[
		{ path: 'family.parents', test: (f) => f.parents !== undefined },
		{ path: 'family.labels', test: (f) => f.labels !== undefined },
		{ path: 'family.spouse', test: (f) => f.spouse !== undefined },
		{
			path: 'family.children[]',
			test: (f) => Array.isArray(f.children),
		},
		{
			path: 'family.godparents[]',
			test: (f) => Array.isArray(f.godparents),
		},
		{
			path: 'family.groups[].items',
			test: (f) =>
				Array.isArray(f.groups) &&
				f.groups.some((g) => isRecord(g) && g.items !== undefined),
		},
		{
			path: 'family.godparentGroups[].godparents',
			test: (f) =>
				Array.isArray(f.godparentGroups) &&
				f.godparentGroups.some((g) => isRecord(g) && g.godparents !== undefined),
		},
	];

/**
 * Deterministic, non-mutating audit of a persisted draft document against the
 * canonical flat Draft contract.
 */
export function auditDraftContract(
	content: Record<string, unknown> | null | undefined,
): DraftContractAuditResult {
	if (!content || !isRecord(content)) {
		return {
			canonical: true,
			violations: [],
			normalizationIssues: [],
			removedPublishedOnlyKeys: [],
		};
	}

	const violations: DraftContractViolation[] = [];
	const canonicalized = canonicalizeDraftContent(content);

	for (const key of canonicalized.removedPublishedOnlyKeys) {
		violations.push({
			kind: 'published_only_field',
			path: key,
			detail: 'published-only field must not be persisted on a draft',
		});
	}

	const family = content.family;
	if (isRecord(family)) {
		for (const marker of NESTED_FAMILY_MARKERS) {
			if (!marker.test(family)) continue;
			violations.push({
				kind: 'nested_family_structure',
				path: marker.path,
				detail: 'nested published family shape; expected flat Draft family',
			});
		}
	}

	for (const issue of canonicalized.issues) {
		violations.push({
			kind: 'normalization_unsupported',
			path: issue.path,
			detail: `${issue.reason}: ${issue.detail}`,
		});
	}

	if (canonicalized.changed && violations.length === 0) {
		violations.push({
			kind: 'hybrid_shape',
			path: '$',
			detail: 'draft differs from its canonical flat form',
		});
	}

	const schema = InvitationContentDraftContentSchema.safeParse(canonicalized.content);
	if (!schema.success) {
		for (const issue of schema.error.issues) {
			violations.push({
				kind: 'schema_invalid',
				path: issue.path.join('.') || '$',
				detail: issue.message,
			});
		}
	}

	return {
		canonical: violations.length === 0 && !canonicalized.changed && canonicalized.issues.length === 0,
		violations,
		normalizationIssues: canonicalized.issues,
		removedPublishedOnlyKeys: canonicalized.removedPublishedOnlyKeys,
	};
}
