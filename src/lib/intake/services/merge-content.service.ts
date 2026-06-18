import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { SectionSource } from '@/lib/intake/types';
import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { ALL_EDITOR_KEYS, OBJECT_SECTION_KEYS } from '@/lib/intake/constants';
import { ensureFamilyGodparentExclusivity } from '@/lib/intake/utils';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shallowMergeDefined(base: unknown, overlay: unknown): Record<string, unknown> | undefined {
	const baseObj = isRecord(base) ? base : undefined;
	const overlayObj = isRecord(overlay) ? overlay : undefined;

	if (!baseObj && !overlayObj) return undefined;
	if (!baseObj) return { ...(overlayObj ?? {}) };
	if (!overlayObj) return { ...baseObj };

	const result: Record<string, unknown> = {};

	for (const key of Object.keys(baseObj)) {
		if (baseObj[key] !== undefined) {
			result[key] = baseObj[key];
		}
	}

	for (const key of Object.keys(overlayObj)) {
		if (overlayObj[key] !== undefined) {
			result[key] = overlayObj[key];
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

interface MergeResult {
	content: DraftContent;
	sectionStates: Record<string, SectionSource>;
}

interface MergeOptions {
	allowDemoFallback?: boolean;
	demoContent?: DraftContent | Record<string, unknown>;
}

// eslint-disable-next-line complexity -- Section merging has several branching paths for obj vs scalar and allowDemoFallback.
export function mergePublishedWithDraft(
	publishedContent: DraftContent | Record<string, unknown>,
	draftContent: DraftContent | Record<string, unknown>,
	options: MergeOptions = {},
): MergeResult {
	const publishedFlat = mapNestedToDraftContent(publishedContent as Record<string, unknown>);
	const draftFlat = draftContent as DraftContent;
	const demoFlat = options.demoContent
		? mapNestedToDraftContent(options.demoContent as Record<string, unknown>)
		: ({} as DraftContent);

	const result: DraftContent = {};
	const sectionStates: Record<string, SectionSource> = {};
	const { allowDemoFallback = false } = options;

	for (const key of ALL_EDITOR_KEYS) {
		const draftVal = draftFlat[key as keyof DraftContent];
		const publishedVal = publishedFlat[key as keyof DraftContent];
		const demoVal = demoFlat[key as keyof DraftContent];

		if (
			OBJECT_SECTION_KEYS.has(key) &&
			(isRecord(draftVal) || isRecord(publishedVal) || isRecord(demoVal))
		) {
			if (isRecord(draftVal) || isRecord(publishedVal)) {
				const merged = shallowMergeDefined(publishedVal, draftVal);
				if (merged !== undefined) {
					const normalized =
						key === 'family' ? ensureFamilyGodparentExclusivity(merged) : merged;
					result[key as keyof DraftContent] = structuredClone(
						normalized,
					) as DraftContent[keyof DraftContent];
				}
			} else if (allowDemoFallback && isRecord(demoVal)) {
				result[key as keyof DraftContent] = structuredClone(
					demoVal,
				) as DraftContent[keyof DraftContent];
			}
		} else {
			if (draftVal !== undefined) {
				result[key as keyof DraftContent] = structuredClone(draftVal);
			} else if (publishedVal !== undefined) {
				result[key as keyof DraftContent] = structuredClone(publishedVal);
			} else if (allowDemoFallback && demoVal !== undefined) {
				result[key as keyof DraftContent] = structuredClone(demoVal);
			}
		}

		const resultVal = result[key as keyof DraftContent];
		if (draftVal !== undefined && resultVal !== undefined) {
			sectionStates[key] = 'draft';
		} else if (publishedVal !== undefined && resultVal !== undefined) {
			sectionStates[key] = 'published';
		} else if (allowDemoFallback && demoVal !== undefined && resultVal !== undefined) {
			sectionStates[key] = 'demo';
		} else {
			sectionStates[key] = 'empty';
		}
	}

	// Copy interludes that survived published → draft flattening.
	// Interludes are not in ALL_EDITOR_KEYS (they are not editable section values),
	// so they are never processed by the loop above. We must pass them through
	// explicitly so preview, publish, and render plan can access them from the
	// effective content. Priority: draft > published > demo.
	const interludeVal =
		draftFlat.interludes ??
		publishedFlat.interludes ??
		(allowDemoFallback ? demoFlat.interludes : undefined);
	if (interludeVal !== undefined) {
		result.interludes = structuredClone(interludeVal);
	}

	return { content: result, sectionStates };
}

export function computeEffectiveContent(
	draftContent: Record<string, unknown> | null | undefined,
	publishedContent: Record<string, unknown> | null | undefined,
): DraftContent {
	return mergePublishedWithDraft(publishedContent ?? {}, draftContent ?? {}).content;
}
