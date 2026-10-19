import { buildLayoutData } from '@/lib/invitation/page-data';
import {
	buildAbsoluteSocialUrl,
	buildSocialImageMetadata,
	resolvePublicSiteOrigin,
} from '@/lib/invitation/social-metadata';
import type { InvitationViewModel } from '@/lib/adapters/types';

const PRODUCTION_ORIGIN = 'https://www.celebra-me.com';

const baseViewModel: InvitationViewModel = {
	id: 'fixture-event',
	isDemo: false,
	title: 'XV Años de Valeria Ruiz',
	description:
		'Una invitación de palacio con rosas rojas, luz de velas y una atmósfera cálida de gala para celebrar XV años.',
	theme: {
		preset: 'enchanted-rose',
		themeClass: 'theme-preset--enchanted-rose',
	},
	hero: {
		name: 'Valeria Ruiz',
		secondaryName: '',
		label: 'Mis XV años',
		date: '2026-08-01T18:00:00Z',
		variant: 'standard',
		backgroundImage: {
			src: '/_astro/portrait.CWMjVgq3.webp',
			alt: 'Retrato de Valeria Ruiz',
		},
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: false,
		showContactCta: false,
	},
	sectionOrder: [],
	composition: { intersections: {} },
	sections: {},
};

function simulateShortIdMetadata(input: {
	viewModel: InvitationViewModel;
	shortId: string;
	eventType: string;
	eventSlug: string;
	guestName?: string;
	localOrigin?: string;
}) {
	const siteOrigin = resolvePublicSiteOrigin({
		configuredOrigin: input.localOrigin ?? 'http://127.0.0.1:4321',
	});

	const layoutData = buildLayoutData(input.viewModel, input.guestName);

	const canonicalUrl = new URL(
		`/${input.eventType}/${input.eventSlug}/i/${input.shortId}`,
		siteOrigin,
	).href;
	const canonicalSocialUrl = buildAbsoluteSocialUrl(canonicalUrl, siteOrigin);

	const ogImage = layoutData.image
		? buildSocialImageMetadata(layoutData.image, { origin: siteOrigin })
		: buildSocialImageMetadata('/images/og-image.webp', { origin: siteOrigin });

	return {
		title: layoutData.title,
		description: layoutData.description,
		ogUrl: canonicalSocialUrl,
		ogTitle: layoutData.title,
		ogDescription: layoutData.description,
		ogImage: ogImage.url,
		canonical: canonicalSocialUrl,
		twitterUrl: canonicalSocialUrl,
		twitterTitle: layoutData.title,
		twitterDescription: layoutData.description,
		twitterImage: ogImage.url,
	};
}

function assertNoLocalhost(metadata: ReturnType<typeof simulateShortIdMetadata>) {
	for (const value of Object.values(metadata)) {
		expect(value).not.toContain('localhost');
		expect(value).not.toContain('127.0.0.1');
	}
}

describe('shortId route metadata (social crawler path)', () => {
	it('renders production-safe URLs even when local origin is 127.0.0.1', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://127.0.0.1:4321',
		});

		assertNoLocalhost(metadata);
		expect(metadata.ogUrl).toBe(`${PRODUCTION_ORIGIN}/xv/fixture-event/i/FXTR7K2M`);
		expect(metadata.canonical).toBe(`${PRODUCTION_ORIGIN}/xv/fixture-event/i/FXTR7K2M`);
		expect(metadata.ogImage).toContain(PRODUCTION_ORIGIN);
	});

	it('renders production-safe URLs even when local origin is localhost', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://localhost:4321',
		});

		assertNoLocalhost(metadata);
		expect(metadata.ogUrl).toContain(PRODUCTION_ORIGIN);
	});

	it('uses sharing.ogDescription for og:description when present', () => {
		const viewModelWithOgDescription: InvitationViewModel = {
			...baseViewModel,
			sharing: {
				ogDescription:
					'Celebra con nosotros una noche especial por los XV años de Valeria Ruiz.',
			},
		};

		const metadata = simulateShortIdMetadata({
			viewModel: viewModelWithOgDescription,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogDescription).toBe(
			'Celebra con nosotros una noche especial por los XV años de Valeria Ruiz.',
		);
		expect(metadata.twitterDescription).toBe(
			'Celebra con nosotros una noche especial por los XV años de Valeria Ruiz.',
		);
		expect(metadata.description).toBe(
			'Celebra con nosotros una noche especial por los XV años de Valeria Ruiz.',
		);
	});

	it('falls back to viewModel.description when sharing.ogDescription is absent', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogDescription).toBe(baseViewModel.description);
	});

	it('does not contain Isabella Rose in any metadata field', () => {
		const viewModelWithOgDescription: InvitationViewModel = {
			...baseViewModel,
			sharing: {
				ogDescription: 'Acompáñanos a celebrar los XV años de Valeria Ruiz.',
			},
		};

		const metadata = simulateShortIdMetadata({
			viewModel: viewModelWithOgDescription,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://127.0.0.1:4321',
		});

		for (const value of Object.values(metadata)) {
			expect(value).not.toContain('Isabella Rose');
			expect(value).not.toContain('Isabella');
		}
	});

	it('produces absolute HTTPS image URLs', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogImage).toMatch(/^https:\/\//);
		expect(metadata.twitterImage).toMatch(/^https:\/\//);
	});

	it('uses guest name in og:title when guest is present', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'FXTR7K2M',
			eventType: 'xv',
			eventSlug: 'fixture-event',
			guestName: 'Francisco Prueba',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogTitle).toBe('Invitación para Francisco Prueba');
	});

	describe('social image metadata', () => {
		const R2_HERO =
			'https://media.celebra-me.com/invitations/xv/xv-renata/hero-' +
			'a'.repeat(64) +
			'.webp';
		const R2_SOCIAL = R2_HERO.replace(/\.webp$/, '.og.jpg');

		it('passes hosted R2 image URLs through without rewriting them', () => {
			const r2ViewModel: InvitationViewModel = {
				...baseViewModel,
				hero: {
					...baseViewModel.hero,
					backgroundImage: { src: R2_HERO, alt: 'Hero Renata' },
				},
			};

			const metadata = simulateShortIdMetadata({
				viewModel: r2ViewModel,
				shortId: 'FXTR8N4P',
				eventType: 'xv',
				eventSlug: 'xv-renata',
			});

			expect(metadata.ogImage).toBe(R2_HERO);
			expect(metadata.twitterImage).toBe(R2_HERO);
		});

		it('keeps the provisioned R2 social card (.og.jpg) as a 1200x630 JPEG', () => {
			const imageMeta = buildSocialImageMetadata(R2_SOCIAL, { origin: PRODUCTION_ORIGIN });

			expect(imageMeta.url).toBe(R2_SOCIAL);
			expect(imageMeta.width).toBe(1200);
			expect(imageMeta.height).toBe(630);
			expect(imageMeta.type).toBe('image/jpeg');
		});

		it('preserves local and Supabase images without injecting transformations', () => {
			const localImageMeta = buildSocialImageMetadata('/images/og-image.webp', {
				origin: PRODUCTION_ORIGIN,
			});
			expect(localImageMeta.url).toBe(`${PRODUCTION_ORIGIN}/images/og-image.webp`);
			expect(localImageMeta.type).toBe('image/webp');

			const supabaseUrl =
				'https://proj.supabase.co/storage/v1/object/public/invitations/hero.png';
			const supabaseMeta = buildSocialImageMetadata(supabaseUrl, {
				origin: PRODUCTION_ORIGIN,
			});
			expect(supabaseMeta.url).toBe(supabaseUrl);
			expect(supabaseMeta.type).toBe('image/png');
		});
	});
});
