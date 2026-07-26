import { describe, expect, it } from '@jest/globals';
import { rominaInvitation } from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';
import { adaptEvent } from '../../src/lib/adapters/event.ts';
import { buildInvitationSectionRenderDescriptors } from '../../src/lib/invitation/section-render-data.ts';
import { buildInvitationRenderPlan } from '../../src/lib/invitation/render-plan.ts';
import { parseEventContentData } from '../helpers/event-content-fixture.ts';

describe('Romina Family Eyebrow & Title Pipeline Contract', () => {
	it('proves end-to-end definition -> release -> projection -> adapter -> descriptor contract for Family labels', () => {
		// 1. Definition -> 2. Published Projection (via semantic asset map)
		const publishedProjection = parseEventContentData(
			rominaInvitation.buildPublishedContent(buildSemanticAssetMap(rominaInvitation)),
		);

		expect(publishedProjection.family).toBeDefined();
		expect(publishedProjection.family?.labels?.sectionSubtitle).toBe('Familia');
		expect(publishedProjection.family?.labels?.sectionTitle).toBe(
			'Con el amor de mis padres y la compañía de mis padrinos',
		);
		// Obsolete top-level eyebrow and title on family object should be absent
		expect((publishedProjection.family as Record<string, unknown>).eyebrow).toBeUndefined();

		// 3. Adapter -> ViewModel
		const viewModel = adaptEvent({
			id: 'romina-rios-chaparro',
			collection: 'event-demos',
			data: publishedProjection,
		});
		expect(viewModel.sections.family).toBeDefined();
		expect(viewModel.sections.family?.labels?.sectionSubtitle).toBe('Familia');
		expect(viewModel.sections.family?.labels?.sectionTitle).toBe(
			'Con el amor de mis padres y la compañía de mis padrinos',
		);

		// 4. Render Plan + Section Render Descriptors -> Family component props
		const renderPlan = buildInvitationRenderPlan(viewModel);
		const descriptors = buildInvitationSectionRenderDescriptors({
			viewModel,
			renderPlan,
			layout: { title: '', description: '', image: '' },
			wrapper: { className: '', showEnvelope: false, dataAttributes: {}, scopedStyles: '' },
			footerVariant: 'premiere-floral',
			footerClosingPhrase: 'Con cariño',
		});

		const familyDescriptor = descriptors.find((d) => d.component === 'family');
		expect(familyDescriptor).toBeDefined();
		if (familyDescriptor && familyDescriptor.component === 'family') {
			expect(familyDescriptor.props.labels?.sectionSubtitle).toBe('Familia');
			expect(familyDescriptor.props.labels?.sectionTitle).toBe(
				'Con el amor de mis padres y la compañía de mis padrinos',
			);
		}
	});
});
