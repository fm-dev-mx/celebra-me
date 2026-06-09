import { buildLayoutData } from '@/lib/invitation/page-data';
import {
	buildAbsoluteSocialUrl,
	buildSocialImageMetadata,
	resolvePublicSiteOrigin,
} from '@/lib/invitation/social-metadata';
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

	it('uses sharing.ogDescription when available', () => {
		const viewModel: InvitationViewModel = {
			...baseViewModel,
			sharing: {
				ogDescription: 'Acompáñanos a celebrar los XV años de Ayrin Samantha.',
			},
		};
		const result = buildLayoutData(viewModel, undefined);

		expect(result.description).toBe('Acompáñanos a celebrar los XV años de Ayrin Samantha.');
	});

	it('falls back to viewModel.description when sharing.ogDescription is missing', () => {
		const result = buildLayoutData(baseViewModel, undefined);

		expect(result.description).toBe('A beautiful test invitation description.');
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

describe('shortId social metadata helpers', () => {
	it('does not use localhost origins for production-facing metadata', () => {
		const origin = resolvePublicSiteOrigin({
			configuredOrigin: 'http://127.0.0.1:4321',
			fallbackOrigin: 'https://www.celebra-me.com',
		});

		expect(origin).toBe('https://www.celebra-me.com');
		expect(origin).not.toContain('127.0.0.1');
		expect(origin).not.toContain('localhost');
	});

	it('filters out localhost when passed as configuredOrigin', () => {
		const origin = resolvePublicSiteOrigin({
			configuredOrigin: 'http://localhost:4321',
		});

		expect(origin).toBe('https://www.celebra-me.com');
		expect(origin).not.toContain('localhost');
	});

	it('filters out 127.0.0.1 when passed as configuredOrigin', () => {
		const origin = resolvePublicSiteOrigin({
			configuredOrigin: 'http://127.0.0.1:4321',
		});

		expect(origin).toBe('https://www.celebra-me.com');
		expect(origin).not.toContain('127.0.0.1');
	});

	it('keeps og:image absolute and fetchable-looking', () => {
		const image = buildSocialImageMetadata('/_astro/portrait.webp', {
			origin: 'https://www.celebra-me.com',
		});

		expect(image.url).toBe('https://www.celebra-me.com/_astro/portrait.webp');
		expect(image.url).not.toContain('127.0.0.1');
		expect(image.url).not.toContain('localhost');
		expect(image.type).toBe('image/webp');
		expect(image.width).toBe(1200);
		expect(image.height).toBe(630);
	});

	it('buildAbsoluteSocialUrl rewrites local origins to production', () => {
		const url = buildAbsoluteSocialUrl('http://127.0.0.1:4321/xv/test/i/ABC123', {
			configuredOrigin: 'http://127.0.0.1:4321',
		} as any);

		expect(url).toBe('https://www.celebra-me.com/xv/test/i/ABC123');
		expect(url).not.toContain('127.0.0.1');
		expect(url).not.toContain('localhost');
	});

	it('buildSocialImageMetadata rewrites local image URLs to production', () => {
		const image = buildSocialImageMetadata('/_astro/portrait.CWMjVgq3.webp', {
			origin: 'http://127.0.0.1:4321',
		});

		expect(image.url).toBe('https://www.celebra-me.com/_astro/portrait.CWMjVgq3.webp');
		expect(image.url).not.toContain('127.0.0.1');
		expect(image.url).not.toContain('localhost');
	});
});
