import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import { canonicalizePublicationValue } from '@/lib/intake/services/publication-canonicalize';

const DIRTY_KEY_TO_SECTION: Partial<Record<keyof DraftContent, InvitationEditorSectionKey>> = {
	title: 'main',
	description: 'main',
	hero: 'main',
	quote: 'messages',
	thankYou: 'messages',
	sectionOrder: 'publication',
	eventTiming: 'location',
};

export function getDirtySectionKey(key: keyof DraftContent): InvitationEditorSectionKey {
	return DIRTY_KEY_TO_SECTION[key] ?? (key as InvitationEditorSectionKey);
}

export function getSectionValue(
	content: DraftContent,
	section: InvitationEditorSectionKey,
): unknown {
	if (section === 'main') {
		return {
			title: content.title,
			description: content.description,
			hero: content.hero ?? {},
		};
	}
	if (section === 'messages') return { quote: content.quote, thankYou: content.thankYou };
	if (section === 'location') {
		return { ...(content.location ?? {}), eventTiming: content.eventTiming };
	}
	if (section === 'publication') return { sectionOrder: content.sectionOrder ?? [] };
	return content[section as keyof DraftContent] ?? {};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(canonicalizePublicationValue(left) ?? null) ===
		JSON.stringify(canonicalizePublicationValue(right) ?? null)
	);
}

/**
 * Build a section payload that keeps baseline field identity for untouched paths
 * and only overlays fields that actually changed in the editor.
 */
export function mergeSectionSaveValue(baselineValue: unknown, currentValue: unknown): unknown {
	if (valuesEqual(baselineValue, currentValue)) {
		return baselineValue === undefined ? currentValue : structuredClone(baselineValue);
	}
	if (Array.isArray(baselineValue) || Array.isArray(currentValue)) {
		return structuredClone(currentValue);
	}
	if (!isPlainObject(baselineValue) || !isPlainObject(currentValue)) {
		return structuredClone(currentValue);
	}

	const result: Record<string, unknown> = structuredClone(baselineValue);
	const keys = new Set([...Object.keys(baselineValue), ...Object.keys(currentValue)]);
	for (const key of keys) {
		const baselineChild = baselineValue[key];
		const currentChild = currentValue[key];
		if (!(key in currentValue)) {
			delete result[key];
			continue;
		}
		if (!(key in baselineValue)) {
			result[key] = structuredClone(currentChild);
			continue;
		}
		if (valuesEqual(baselineChild, currentChild)) {
			result[key] = structuredClone(baselineChild);
			continue;
		}
		result[key] = mergeSectionSaveValue(baselineChild, currentChild) as unknown;
	}
	return result;
}

/** Section save value with only editor-changed fields overlaid on the baseline section. */
export function buildSectionSaveValue(
	baselineContent: DraftContent,
	currentContent: DraftContent,
	section: InvitationEditorSectionKey,
): unknown {
	return mergeSectionSaveValue(
		getSectionValue(baselineContent, section),
		getSectionValue(currentContent, section),
	);
}

export function applySectionValue(
	content: DraftContent,
	section: InvitationEditorSectionKey,
	value: unknown,
): DraftContent {
	const next = structuredClone(content);

	if (section === 'main') {
		const main = value as Pick<DraftContent, 'title' | 'description' | 'hero'>;
		return { ...next, title: main.title, description: main.description, hero: main.hero };
	}
	if (section === 'messages') {
		const messages = value as Pick<DraftContent, 'quote' | 'thankYou'>;
		return { ...next, quote: messages.quote, thankYou: messages.thankYou };
	}
	if (section === 'location') {
		const { eventTiming, ...location } = value as NonNullable<DraftContent['location']> & {
			eventTiming?: DraftContent['eventTiming'];
		};
		return {
			...next,
			location,
			eventTiming,
		};
	}
	if (section === 'publication') {
		const publication = value as Pick<DraftContent, 'sectionOrder'>;
		return { ...next, sectionOrder: publication.sectionOrder };
	}

	return { ...next, [section]: value };
}

export function applySectionToBaseline(
	baseline: DraftContent,
	section: InvitationEditorSectionKey,
	source: DraftContent,
): DraftContent {
	if (section === 'main') {
		return {
			...baseline,
			title: source.title,
			description: source.description,
			hero: source.hero,
		};
	}
	if (section === 'messages') {
		return { ...baseline, quote: source.quote, thankYou: source.thankYou };
	}
	if (section === 'location') {
		return { ...baseline, location: source.location, eventTiming: source.eventTiming };
	}
	if (section === 'publication') {
		return { ...baseline, sectionOrder: source.sectionOrder };
	}
	return { ...baseline, [section]: source[section as keyof DraftContent] };
}
