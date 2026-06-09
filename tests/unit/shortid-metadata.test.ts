import { buildLayoutData } from '@/lib/invitation/page-data';
import {
	buildAbsoluteSocialUrl,
	buildSocialImageMetadata,
	resolvePublicSiteOrigin,
} from '@/lib/invitation/social-metadata';
import type { InvitationViewModel } from '@/lib/adapters/types';

const PRODUCTION_ORIGIN = 'https://www.celebra-me.com';

const baseViewModel: InvitationViewModel = {
	id: 'ayrin-samantha-lerma-castro',
	isDemo: false,
	title: 'XV Años de Ayrin Samantha',
	description:
		'Una invitación de palacio con rosas rojas, luz de velas y una atmósfera cálida de gala para celebrar XV años.',
	theme: {
		preset: 'enchanted-rose',
		themeClass: 'theme-preset--enchanted-rose',
	},
	hero: {
		name: 'Ayrin Samantha Lerma Castro',
		secondaryName: '',
		label: 'Mis XV años',
		date: '2026-08-01T18:00:00Z',
		variant: 'enchanted-rose',
		backgroundImage: {
			src: '/_astro/portrait.CWMjVgq3.webp',
			alt: 'Retrato de Ayrin Samantha',
		},
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: false,
		showContactCta: false,
		showThankYouBranding: false,
	},
	sectionOrder: [],
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
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
			localOrigin: 'http://127.0.0.1:4321',
		});

		assertNoLocalhost(metadata);
		expect(metadata.ogUrl).toBe(
			`${PRODUCTION_ORIGIN}/xv/ayrin-samantha-lerma-castro/i/GBOER6UK`,
		);
		expect(metadata.canonical).toBe(
			`${PRODUCTION_ORIGIN}/xv/ayrin-samantha-lerma-castro/i/GBOER6UK`,
		);
		expect(metadata.ogImage).toContain(PRODUCTION_ORIGIN);
	});

	it('renders production-safe URLs even when local origin is localhost', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
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
					'Celebra con nosotros una noche especial por los XV años de Ayrin Samantha.',
			},
		};

		const metadata = simulateShortIdMetadata({
			viewModel: viewModelWithOgDescription,
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogDescription).toBe(
			'Celebra con nosotros una noche especial por los XV años de Ayrin Samantha.',
		);
		expect(metadata.twitterDescription).toBe(
			'Celebra con nosotros una noche especial por los XV años de Ayrin Samantha.',
		);
		expect(metadata.description).toBe(
			'Celebra con nosotros una noche especial por los XV años de Ayrin Samantha.',
		);
	});

	it('falls back to viewModel.description when sharing.ogDescription is absent', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogDescription).toBe(baseViewModel.description);
	});

	it('does not contain Isabella Rose in any metadata field', () => {
		const viewModelWithOgDescription: InvitationViewModel = {
			...baseViewModel,
			sharing: {
				ogDescription: 'Acompáñanos a celebrar los XV años de Ayrin Samantha.',
			},
		};

		const metadata = simulateShortIdMetadata({
			viewModel: viewModelWithOgDescription,
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
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
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogImage).toMatch(/^https:\/\//);
		expect(metadata.twitterImage).toMatch(/^https:\/\//);
	});

	it('uses guest name in og:title when guest is present', () => {
		const metadata = simulateShortIdMetadata({
			viewModel: baseViewModel,
			shortId: 'GBOER6UK',
			eventType: 'xv',
			eventSlug: 'ayrin-samantha-lerma-castro',
			guestName: 'Francisco Prueba',
			localOrigin: 'http://127.0.0.1:4321',
		});

		expect(metadata.ogTitle).toBe('Invitación para Francisco Prueba');
	});
});
