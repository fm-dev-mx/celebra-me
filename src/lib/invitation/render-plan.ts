import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { InvitationViewModel } from '@/lib/adapters/types';
import { CONTENT_SECTION_KEYS, type ThemePreset } from '@/lib/theme/theme-contract';

export type InterludeRenderItem = {
	type: 'interlude';
	image: ImageAsset;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
	variant?: ThemePreset;
	focalPoint?: string;
	lightX?: string;
	lightY?: string;
	overlayOpacity?: string;
};

export type InvitationRenderPlanItem =
	| {
			type: 'section';
			section: keyof InvitationViewModel['sections'];
	  }
	| {
			type: 'personalized-access';
	  }
	| InterludeRenderItem;

const DEFAULT_THEME_PRESET: ThemePreset = 'jewelry-box';

function hasRenderableSection(
	viewModel: InvitationViewModel,
	section: keyof InvitationViewModel['sections'],
): boolean {
	return Boolean(viewModel.sections[section]);
}

function appendSectionWithInterludes(
	items: InvitationRenderPlanItem[],
	viewModel: InvitationViewModel,
	section: keyof InvitationViewModel['sections'],
): void {
	items.push({ type: 'section', section });

	for (const interlude of (viewModel.interludes ?? []).filter(
		(i) => i.afterSection === section,
	)) {
		items.push(
			interludeToRenderItem(interlude, viewModel.theme.preset ?? DEFAULT_THEME_PRESET),
		);
	}
}

function interludeToRenderItem(
	interlude: NonNullable<InvitationViewModel['interludes']>[number],
	themePreset: ThemePreset,
): InterludeRenderItem {
	return {
		type: 'interlude',
		image: interlude.image,
		alt: interlude.alt,
		height: interlude.height,
		variant: interlude.variant ?? themePreset,
		focalPoint: interlude.focalPoint,
		lightX: interlude.lightX,
		lightY: interlude.lightY,
		overlayOpacity: interlude.overlayOpacity,
	};
}

export function buildInvitationRenderPlan(
	viewModel: InvitationViewModel,
	options?: {
		hasGuestContext?: boolean;
		isDemoPreview?: boolean;
	},
): InvitationRenderPlanItem[] {
	const hasGuestContext = options?.hasGuestContext ?? false;
	const isDemoPreview = options?.isDemoPreview ?? false;
	const items: InvitationRenderPlanItem[] = [];
	const showPersonalizedAccess = hasGuestContext || isDemoPreview;
	const sectionOrder = viewModel.sectionOrder;

	if (sectionOrder) {
		for (const section of sectionOrder) {
			if (section === 'personalizedAccess') {
				items.push({ type: 'personalized-access' });
				continue;
			}

			if (!hasRenderableSection(viewModel, section)) continue;
			appendSectionWithInterludes(items, viewModel, section);
		}
	} else {
		for (const section of CONTENT_SECTION_KEYS) {
			if (!hasRenderableSection(viewModel, section)) continue;

			if (section === 'rsvp' && showPersonalizedAccess) {
				items.push({ type: 'personalized-access' });
			}

			appendSectionWithInterludes(items, viewModel, section);
		}
	}

	return items;
}
