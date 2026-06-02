import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import { deepClone } from '@/lib/intake/utils';

const COMPOUND_SECTIONS = new Set<InvitationEditorSectionKey>(['main', 'messages', 'publication']);

const SECTION_KEY_MAP: Record<InvitationEditorSectionKey, (keyof DraftContent)[]> = {
	main: ['title', 'description', 'hero'],
	family: ['family'],
	location: ['location'],
	itinerary: ['itinerary'],
	rsvp: ['rsvp'],
	music: ['music'],
	gifts: ['gifts'],
	messages: ['quote', 'thankYou'],
	gallery: ['gallery'],
	photoNotes: ['photoNotes'],
	publication: ['sectionOrder'],
};

export function getDirtySectionKey(key: keyof DraftContent): InvitationEditorSectionKey {
	if (key === 'title' || key === 'description' || key === 'hero') return 'main';
	if (key === 'quote' || key === 'thankYou') return 'messages';
	if (key === 'sectionOrder') return 'publication';
	return key as InvitationEditorSectionKey;
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
	if (section === 'publication') return { sectionOrder: content.sectionOrder ?? [] };
	return content[section as keyof DraftContent] ?? {};
}

export function applySectionValue(
	content: DraftContent,
	section: InvitationEditorSectionKey,
	value: unknown,
): DraftContent {
	const next = deepClone(content);

	if (section === 'main') {
		const main = value as Pick<DraftContent, 'title' | 'description' | 'hero'>;
		return { ...next, title: main.title, description: main.description, hero: main.hero };
	}
	if (section === 'messages') {
		const messages = value as Pick<DraftContent, 'quote' | 'thankYou'>;
		return { ...next, quote: messages.quote, thankYou: messages.thankYou };
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
	if (section === 'publication') {
		return { ...baseline, sectionOrder: source.sectionOrder };
	}
	return { ...baseline, [section]: source[section as keyof DraftContent] };
}

export { COMPOUND_SECTIONS, SECTION_KEY_MAP };
