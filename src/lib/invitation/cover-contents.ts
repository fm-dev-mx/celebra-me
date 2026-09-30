import type { InvitationViewModel } from '@/lib/adapters/types';
import type { InvitationRenderSectionKey } from '@/lib/theme/theme-contract';

/** One line of the collector cover's table of contents ("En este número"). */
export interface CoverContentsEntry {
	/** Section title as printed in the contents. */
	label: string;
	/** Short section-type kicker for cover lines, e.g. "Programa". */
	kicker: string;
	/** Optional cover-line deck derived from the section's own data, e.g. "5 momentos de la noche". */
	deck?: string;
	/** Two-digit magazine page number, e.g. "04". */
	page: string;
}

type EntryDraft = Omit<CoverContentsEntry, 'page'>;
type Sections = InvitationViewModel['sections'];

const FIRST_PAGE = 4;
const PAGE_STEP = 3;

function clean(label: string | undefined): string | undefined {
	const trimmed = label?.trim().replace(/[.:]+$/, '');
	return trimmed || undefined;
}

const generic =
	(key: keyof Sections, label: string) =>
	(sections: Sections): EntryDraft | undefined =>
		sections[key] ? { label, kicker: label } : undefined;

/** Per-section contents builders; sections without one (quote, countdown…) are skipped. */
const BUILDERS: Partial<
	Record<InvitationRenderSectionKey, (sections: Sections) => EntryDraft | undefined>
> = {
	family: ({ family }) =>
		family
			? {
					label: clean(family.labels?.sectionTitle) ?? 'Familia',
					kicker: clean(family.labels?.sectionSubtitle) ?? 'Familia',
				}
			: undefined,
	itinerary: ({ itinerary }) => {
		if (!itinerary) return undefined;
		const count = itinerary.items?.length ?? 0;
		return {
			label: clean(itinerary.title) ?? 'Programa',
			kicker: 'Programa',
			deck: count > 1 ? `${count} momentos de la noche` : undefined,
		};
	},
	gallery: ({ gallery }) =>
		gallery
			? {
					label: clean(gallery.title) ?? 'Galería',
					kicker: clean(gallery.eyebrow) ?? 'Galería',
				}
			: undefined,
	gifts: ({ gifts }) =>
		gifts ? { label: clean(gifts.title) ?? 'Regalos', kicker: 'Regalos' } : undefined,
	location: generic('location', 'Lugar'),
	rsvp: generic('rsvp', 'Confirmación'),
	thankYou: generic('thankYou', 'Agradecimiento'),
};

/**
 * Table of contents for the collector cover, in the invitation's real section order, using
 * each section's own title where it has one. Decks only restate the section's own data.
 */
export function buildCoverContents(viewModel: InvitationViewModel): CoverContentsEntry[] {
	const entries: CoverContentsEntry[] = [];
	for (const key of viewModel.sectionOrder) {
		const entry = BUILDERS[key]?.(viewModel.sections);
		if (!entry) continue;
		const page = FIRST_PAGE + entries.length * PAGE_STEP;
		entries.push({ ...entry, page: String(page).padStart(2, '0') });
	}
	return entries;
}
