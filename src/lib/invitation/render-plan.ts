import type { ContentBlock, ContentSectionKey, InvitationViewModel } from '@/lib/adapters/types';

export type InvitationRenderPlanItem =
	| ContentBlock
	| {
			type: 'personalized-access';
	  };

const DEFAULT_SECTION_ORDER: ContentSectionKey[] = [
	'quote',
	'family',
	'gallery',
	'countdown',
	'location',
	'itinerary',
	'rsvp',
	'gifts',
	'thankYou',
];

function hasRenderableSection(viewModel: InvitationViewModel, section: ContentSectionKey): boolean {
	return Boolean(viewModel.sections[section]);
}

function appendSection(
	items: InvitationRenderPlanItem[],
	section: ContentSectionKey,
	hasGuestContext: boolean,
): void {
	if (section === 'rsvp' && hasGuestContext) {
		items.push({ type: 'personalized-access' });
	}

	items.push({ type: 'section', section });
}

export function buildInvitationRenderPlan(
	viewModel: InvitationViewModel,
	options?: {
		hasGuestContext?: boolean;
	},
): InvitationRenderPlanItem[] {
	const hasGuestContext = options?.hasGuestContext ?? false;
	const items: InvitationRenderPlanItem[] = [];

	if (viewModel.contentBlocks?.length) {
		for (const block of viewModel.contentBlocks) {
			if (block.type === 'interlude') {
				items.push(block);
				continue;
			}

			if (hasRenderableSection(viewModel, block.section)) {
				appendSection(items, block.section, hasGuestContext);
			}
		}

		return items;
	}

	for (const section of DEFAULT_SECTION_ORDER) {
		if (hasRenderableSection(viewModel, section)) {
			appendSection(items, section, hasGuestContext);
		}
	}

	return items;
}
