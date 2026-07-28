import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { InvitationViewModel } from '@/lib/adapters/types';
import {
	resolveRenderPlanIntersection,
	type RenderPlanIntersection,
} from '@/lib/invitation/intersection-profiles';
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
		intersection: resolveRenderPlanIntersection(viewModel.visualProfileId, section),
	});

	for (const interlude of (viewModel.interludes ?? []).filter(
		(i) => i.afterSection === section,
	)) {
		items.push(
			interludeToRenderItem(
				interlude,
				viewModel.theme.preset ?? DEFAULT_THEME_PRESET,
				viewModel.visualProfileId,
			),
		);
	}
}

function interludeToRenderItem(
	interlude: NonNullable<InvitationViewModel['interludes']>[number],
	themePreset: ThemePreset,
	visualProfileId?: string,
): InterludeRenderItem {
	return {
		type: 'interlude',
		afterSection: interlude.afterSection,
		intersection: resolveRenderPlanIntersection(
			visualProfileId,
			`interlude-after-${interlude.afterSection}`,
		),
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
				items.push({
					type: 'personalized-access',
					intersection: resolveRenderPlanIntersection(
						viewModel.visualProfileId,
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
						viewModel.visualProfileId,
						'personalized-access',
					),
				});
			}

			appendSectionWithInterludes(items, viewModel, section);
		}
	}

	return items;
}
