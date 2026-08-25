/**
 * Family section helpers for Draft → Published mapping.
 * Kept separate so the publish mapper stays within the file-size budget.
 */
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { FamilyDraft } from '@/lib/intake/schemas/family-draft.schema';
import { FAMILY_LABEL_KEYS } from '@/lib/invitation/family-contract';
import { ApiError } from '@/lib/rsvp/core/errors';
import { str, isNonEmptyObject } from '@/lib/shared/data-utils';

function definedFields(
	prior: Record<string, unknown> | undefined,
	keys: readonly string[],
): Record<string, unknown> {
	if (!prior) return {};
	return Object.fromEntries(
		keys.filter((key) => prior[key] !== undefined).map((key) => [key, prior[key]]),
	);
}

/**
 * Publish consumes canonical flat `DraftContent`. A draft that still carries
 * published-shaped family structures would silently lose names here, so it is
 * rejected instead: callers must normalize through `normalizeDraftContent`.
 */
function assertCanonicalFamilyDraft(draftFamily: Record<string, unknown>): void {
	const nestedPaths: string[] = [];
	for (const key of ['parents', 'labels', 'spouse'] as const) {
		if (draftFamily[key] !== undefined) nestedPaths.push(`family.${key}`);
	}
	if (Array.isArray(draftFamily.children)) nestedPaths.push('family.children[]');
	if (Array.isArray(draftFamily.godparents)) nestedPaths.push('family.godparents[]');
	for (const [groupKey, nestedKey] of [
		['groups', 'items'],
		['godparentGroups', 'godparents'],
	] as const) {
		const groups = draftFamily[groupKey];
		if (!Array.isArray(groups)) continue;
		groups.forEach((group, index) => {
			if (isNonEmptyObject(group) && group[nestedKey] !== undefined) {
				nestedPaths.push(`family.${groupKey}[${index}].${nestedKey}`);
			}
		});
	}
	if (nestedPaths.length === 0) return;
	throw new ApiError(
		422,
		'bad_request',
		'El borrador conserva estructuras de contenido publicado y no puede publicarse sin normalizarse.',
		{ nestedPaths },
	);
}

function buildFamilyLabels(draftFamily: FamilyDraft): Record<string, unknown> | undefined {
	const labels: Record<string, unknown> = {};
	for (const key of FAMILY_LABEL_KEYS) {
		const val = str(draftFamily[key]);
		if (val) labels[key] = val;
	}
	return isNonEmptyObject(labels) ? labels : undefined;
}

function parseFamilyLines(text: string): Array<{ name: string; role?: string }> {
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.map((line) => {
			const parts = line.split(' — ').map((s) => s.trim());
			return parts.length > 1 ? { name: parts[0], role: parts[1] } : { name: parts[0] };
		});
}

function buildFamilyGroups(
	draftFamily: FamilyDraft,
): Array<{ title: string; items: Array<{ name: string; role?: string }> }> | undefined {
	const draftGroups = draftFamily.groups;
	if (!draftGroups || draftGroups.length === 0) return undefined;
	const mappedGroups = draftGroups
		.filter((g) => str(g.title) || str(g.names))
		.map((g) => {
			const namesText = str(g.names);
			const items = namesText ? parseFamilyLines(namesText) : [];
			if (items.length === 0) return null;
			return {
				title: str(g.title) || 'Grupo',
				items,
			};
		})
		.filter(
			(g): g is { title: string; items: Array<{ name: string; role?: string }> } =>
				g !== null,
		);
	return mappedGroups.length > 0 ? mappedGroups : undefined;
}

function buildGodparents(
	draftFamily: FamilyDraft,
): Array<{ name: string; role?: string }> | undefined {
	const godparentsText = str(draftFamily.godparents);
	if (!godparentsText) return undefined;
	const godparents = parseFamilyLines(godparentsText);
	return godparents.length > 0 ? godparents : undefined;
}

function buildGodparentGroups(draftFamily: FamilyDraft):
	| Array<{
			honoreeName: string;
			label?: string;
			godparents: Array<{ name: string; role?: string }>;
	  }>
	| undefined {
	const draftGroups = draftFamily.godparentGroups;
	if (!draftGroups || draftGroups.length === 0) return undefined;
	const mappedGroups = draftGroups
		.map((group) => {
			const honoreeName = str(group.honoreeName);
			const namesText = str(group.names);
			if (!honoreeName || !namesText) return null;
			const godparents = parseFamilyLines(namesText);
			if (godparents.length === 0) return null;
			return {
				honoreeName,
				...(str(group.label) ? { label: str(group.label) } : {}),
				godparents,
			};
		})
		.filter(
			(
				group,
			): group is {
				honoreeName: string;
				label?: string;
				godparents: Array<{ name: string; role?: string }>;
			} => group !== null,
		);
	return mappedGroups.length > 0 ? mappedGroups : undefined;
}

function resolveFamilyVariant(
	family: FamilyDraft,
	priorFamily: Record<string, unknown> | undefined,
	demoFamily: Record<string, unknown> | undefined,
): string {
	const variant = family.variant ?? str(priorFamily?.variant) ?? str(demoFamily?.variant);
	if (!variant) throw new Error('Published content requires an explicit family.variant.');
	return variant;
}

export function mapFamilyFromDraft(
	draftFamily: DraftContent['family'],
	priorFamily?: Record<string, unknown>,
	demoFamily?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!isNonEmptyObject(draftFamily)) return undefined;
	assertCanonicalFamilyDraft(draftFamily);
	const family = draftFamily as FamilyDraft;

	const result: Record<string, unknown> = definedFields(priorFamily, ['focalPoint']);
	const parents: Record<string, unknown> = {};

	if (str(family.fatherName)) parents.father = str(family.fatherName);
	if (typeof family.fatherDeceased === 'boolean') parents.fatherDeceased = family.fatherDeceased;
	if (str(family.motherName)) parents.mother = str(family.motherName);
	if (typeof family.motherDeceased === 'boolean') parents.motherDeceased = family.motherDeceased;

	if (isNonEmptyObject(parents)) result.parents = parents;
	if (family.parentsOrder) result.parentsOrder = family.parentsOrder;
	if (str(family.spouseName)) result.spouse = str(family.spouseName);

	const mappedGodparentGroups = buildGodparentGroups(family);
	if (mappedGodparentGroups) {
		result.godparentGroups = mappedGodparentGroups;
	} else {
		const mappedGodparents = buildGodparents(family);
		if (mappedGodparents) result.godparents = mappedGodparents;
	}

	const childrenText = str(family.children);
	if (childrenText) {
		const lines = childrenText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length > 0) {
			result.children = lines.map((name) => ({ name }));
		}
	}

	const labels = buildFamilyLabels(family);
	if (labels) result.labels = labels;

	const mappedGroups = buildFamilyGroups(family);
	if (mappedGroups) result.groups = mappedGroups;

	if (typeof family.visible === 'boolean') result.visible = family.visible;
	if (family.presentation) result.presentation = family.presentation;
	result.variant = resolveFamilyVariant(family, priorFamily, demoFamily);
	if (family.featuredImage) result.featuredImage = family.featuredImage;
	return isNonEmptyObject(result) ? result : undefined;
}
