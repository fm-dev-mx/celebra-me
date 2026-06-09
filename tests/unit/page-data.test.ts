import { buildLayoutData } from '@/lib/invitation/page-data';
import type { InvitationViewModel } from '@/lib/adapters/types';

const baseViewModel: InvitationViewModel = {
	id: 'test-event',
	isDemo: false,
	title: 'Test Event Title',
	description: 'A beautiful test invitation description.',
	theme: {
		preset: 'enchanted-rose',
		themeClass: 'theme-preset--enchanted-rose',
	},
	hero: {
		name: 'Test Event',
		secondaryName: '',
		label: 'Invitación Especial',
		date: '2026-12-31',
		variant: 'enchanted-rose',
		backgroundImage: {
			src: 'https://example.com/hero.jpg',
			alt: 'Portada de Test Event',
		},
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: false,
		showContactCta: false,
		showThankYouBranding: false,
	},
	sectionOrder: ['rsvp'],
	sections: {},
};

describe('buildLayoutData', () => {
	it('builds layout data with title and description from viewModel', () => {
		const result = buildLayoutData(baseViewModel, undefined);

		expect(result.title).toBe('Test Event Title');
		expect(result.description).toBe('A beautiful test invitation description.');
	});

	it('includes guest name in title when guestName is provided', () => {
		const result = buildLayoutData(baseViewModel, 'María García');

		expect(result.title).toBe('Invitación para María García');
	});

	it('uses sharing.ogImage when available', () => {
		const viewModel: InvitationViewModel = {
			...baseViewModel,
			sharing: {
				ogImage: {
					src: 'https://example.com/og-custom.jpg',
					alt: 'Custom OG image',
				},
			},
		};
		const result = buildLayoutData(viewModel, undefined);

		expect(result.image).toBe('https://example.com/og-custom.jpg');
	});

	it('falls back to hero.backgroundImage when sharing.ogImage is missing', () => {
		const result = buildLayoutData(baseViewModel, undefined);

		expect(result.image).toBe('https://example.com/hero.jpg');
	});

	it('returns className based on theme preset', () => {
		const result = buildLayoutData(baseViewModel, undefined);

		expect(result.className).toBe('layout--enchanted-rose');
	});

	it('handles ImageMetadata src in backgroundImage (internal asset)', () => {
		const viewModel: InvitationViewModel = {
			...baseViewModel,
			hero: {
				...baseViewModel.hero,
				backgroundImage: {
					src: {
						src: '/assets/internal-hero.webp',
						width: 1200,
						height: 630,
						format: 'webp',
					} as any,
					alt: 'Portada interna',
				},
			},
		};
		const result = buildLayoutData(viewModel, undefined);

		expect(result.image).toBe('/assets/internal-hero.webp');
	});
});
