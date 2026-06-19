import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

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
