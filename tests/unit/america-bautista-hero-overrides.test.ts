import { applyAmericaBautistaHeroOverrides } from '@/lib/invitation/america-bautista-hero-overrides';
import type { InvitationPageContext } from '@/lib/invitation/page-data';

const image = { src: '/hero.webp', alt: 'Portada' };

function createPageContext(visualProfileId?: string): InvitationPageContext {
	return {
		viewModel: {
			id: 'america-bautista',
			isDemo: false,
			visualProfileId,
			title: 'América Bautista',
			theme: {
				preset: 'celestial-blue',
				themeClass: 'theme-preset--celestial-blue',
			},
			hero: {
				name: 'America Bautista',
				label: 'XV Años',
				date: 'Sábado 14 de febrero',
				venueName: 'Payload venue',
				backgroundImage: image,
				variant: 'celestial-blue',
			},
			envelope: { enabled: false },
			brandingVisibility: {
				showFooterBranding: true,
				showContactCta: true,
				showThankYouBranding: true,
			},
			sections: {},
		},
		renderPlan: [],
		layout: {
			title: 'América Bautista',
			description: 'Invitación',
			image: '/hero.webp',
		},
		wrapper: {
			className: 'event-theme-wrapper event--america-bautista',
			showEnvelope: false,
			dataAttributes: {},
			scopedStyles: '',
		},
		footerVariant: 'celestial-blue',
	};
}

describe('applyAmericaBautistaHeroOverrides', () => {
	it('applies the approved hero copy for the america-bautista route', () => {
		const pageContext = createPageContext();

		applyAmericaBautistaHeroOverrides(pageContext, {
			routeSlug: 'america-bautista',
		});

		expect(pageContext.viewModel.hero.label).toBe('MIS XV AÑOS');
		expect(pageContext.viewModel.hero.name).toBe('América');
		expect(pageContext.heroTime).toBe('8:00 P.M.');
		expect(pageContext.heroVenueName).toBe('GRAN SALÓN DEL PRADO');
	});

	it('also applies the approved copy when the visual profile identifies America Bautista', () => {
		const pageContext = createPageContext('america-bautista');

		applyAmericaBautistaHeroOverrides(pageContext, {
			routeSlug: 'database-slug',
		});

		expect(pageContext.viewModel.hero.name).toBe('América');
		expect(pageContext.heroVenueName).toBe('GRAN SALÓN DEL PRADO');
	});

	it('leaves unrelated invitations unchanged', () => {
		const pageContext = createPageContext('another-profile');

		applyAmericaBautistaHeroOverrides(pageContext, {
			routeSlug: 'another-slug',
		});

		expect(pageContext.viewModel.hero.label).toBe('XV Años');
		expect(pageContext.viewModel.hero.name).toBe('America Bautista');
		expect(pageContext.heroTime).toBeUndefined();
		expect(pageContext.heroVenueName).toBeUndefined();
	});
});
