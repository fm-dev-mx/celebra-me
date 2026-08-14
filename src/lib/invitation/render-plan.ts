import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { InvitationViewModel } from '@/lib/adapters/types';
import {
	resolveRenderPlanIntersection,
	type InvitationComposition,
	type RenderPlanIntersection,
} from '@/lib/invitation/composition-contract';
import { CONTENT_SECTION_KEYS, type ThemePreset } from '@/lib/theme/theme-contract';

type RenderPlanMetadata = {
	intersection: RenderPlanIntersection;
};

export type InterludeRenderItem = RenderPlanMetadata & {
	type: 'interlude';
	afterSection: keyof InvitationViewModel['sections'];
	image: ImageAsset;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
	variant?: ThemePreset;
	focalPoint?: string;
	focalPointDesktop?: string;
	lightX?: string;
	lightY?: string;
	overlayOpacity?: string;
};

export type InvitationRenderPlanItem =
	| (RenderPlanMetadata & {
			type: 'section';
			section: keyof InvitationViewModel['sections'];
	  })
	| (RenderPlanMetadata & {
			type: 'personalized-access';
	  })
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
	items.push({
		type: 'section',
		section,
		intersection: resolveRenderPlanIntersection(viewModel.composition, section),
	});

	for (const interlude of (viewModel.interludes ?? []).filter(
		(i) => i.afterSection === section,
	)) {
		items.push(
			interludeToRenderItem(
				interlude,
				viewModel.theme.preset ?? DEFAULT_THEME_PRESET,
				viewModel.composition,
			),
		);
	}
}

function interludeToRenderItem(
	interlude: NonNullable<InvitationViewModel['interludes']>[number],
	themePreset: ThemePreset,
	composition?: InvitationComposition,
): InterludeRenderItem {
	return {
		type: 'interlude',
		afterSection: interlude.afterSection,
		intersection: resolveRenderPlanIntersection(
			composition,
			`interlude-after-${interlude.afterSection}`,
		),
		image: interlude.image,
		alt: interlude.alt,
		height: interlude.height,
		variant: interlude.variant ?? themePreset,
		focalPoint: interlude.focalPoint,
		focalPointDesktop: interlude.focalPointDesktop,
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
				items.push({
					type: 'personalized-access',
					intersection: resolveRenderPlanIntersection(
						viewModel.composition,
						'personalized-access',
					),
				});
				continue;
			}

			if (!hasRenderableSection(viewModel, section)) continue;
			appendSectionWithInterludes(items, viewModel, section);
		}
	} else {
		for (const section of CONTENT_SECTION_KEYS) {
			if (!hasRenderableSection(viewModel, section)) continue;

			if (section === 'rsvp' && showPersonalizedAccess) {
				items.push({
					type: 'personalized-access',
					intersection: resolveRenderPlanIntersection(
						viewModel.composition,
						'personalized-access',
					),
				});
			}

			appendSectionWithInterludes(items, viewModel, section);
		}
	}

	return items;
}
