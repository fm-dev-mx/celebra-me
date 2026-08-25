import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { InvitationViewModel } from '@/lib/adapters/types';
import {
	resolveRenderPlanIntersection,
	type InvitationComposition,
	type RenderPlanIntersection,
} from '@/lib/invitation/composition-contract';

type RenderPlanMetadata = {
	intersection: RenderPlanIntersection;
};

export type InterludeRenderItem = RenderPlanMetadata & {
	type: 'interlude';
	afterSection: keyof InvitationViewModel['sections'];
	image: ImageAsset;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
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
		items.push(interludeToRenderItem(interlude, viewModel.composition));
	}
}

function interludeToRenderItem(
	interlude: NonNullable<InvitationViewModel['interludes']>[number],
	composition: InvitationComposition,
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
		focalPoint: interlude.focalPoint,
		focalPointDesktop: interlude.focalPointDesktop,
		lightX: interlude.lightX,
		lightY: interlude.lightY,
		overlayOpacity: interlude.overlayOpacity,
	};
}

export function buildInvitationRenderPlan(
	viewModel: InvitationViewModel,
): InvitationRenderPlanItem[] {
	const items: InvitationRenderPlanItem[] = [];
	for (const section of viewModel.sectionOrder) {
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

	return items;
}
