import {
	buildInvitationStylesheetHeadLinks,
	DEFERRED_INVITATION_CSS_MEDIA,
} from '@/lib/invitation/invitation-css-head-links';
import {
	invitationProfileNeedsParisienne,
	PARISIENNE_GOOGLE_FONTS_HREF,
} from '@/lib/invitation/invitation-profile-css';
import type { InvitationCssLoadItem } from '@/lib/invitation/section-css-resolver-map';

const plan: InvitationCssLoadItem[] = [
	{ href: '/_astro/editorial-bundle.css', owner: 'section-bundle', blocking: false },
	{ href: '/_astro/reveal-premiere-floral.css', owner: 'envelope-reveal', blocking: true },
 { href: '/_astro/family-split-groups.css', owner: 'section-variant', blocking: false },
	{ href: '/_astro/renata-profile.css', owner: 'visual-profile', blocking: true },
];

describe('invitation-css-head-links', () => {
	it('defers non-envelope sheets and keeps preset, reveal, and profile blocking', () => {
		expect(
			buildInvitationStylesheetHeadLinks({
				presetUrl: '/_astro/editorial-preset.css',
				plan,
				profileIdentity: { visualProfileId: 'renata' },
			}),
		).toEqual([
			{ rel: 'stylesheet', href: '/_astro/editorial-preset.css' },
			{
				rel: 'stylesheet',
				href: '/_astro/editorial-bundle.css',
				media: DEFERRED_INVITATION_CSS_MEDIA,
				deferredCss: true,
			},
			{ rel: 'stylesheet', href: '/_astro/reveal-premiere-floral.css' },
			{
				rel: 'stylesheet',
				href: '/_astro/family-split-groups.css',
				media: DEFERRED_INVITATION_CSS_MEDIA,
				deferredCss: true,
			},
			{ rel: 'stylesheet', href: '/_astro/renata-profile.css' },
		]);
	});

	it('does not inject Parisienne except for the Romina profile', () => {
		expect(invitationProfileNeedsParisienne({ visualProfileId: 'renata' })).toBe(false);
		expect(invitationProfileNeedsParisienne({ slug: 'america-johana' })).toBe(false);
		expect(invitationProfileNeedsParisienne({ visualProfileId: 'romina-rios-chaparro' })).toBe(
			true,
		);

		const renataLinks = buildInvitationStylesheetHeadLinks({
			plan: [],
			profileIdentity: { visualProfileId: 'renata' },
		});
		expect(renataLinks.some((link) => link.href === PARISIENNE_GOOGLE_FONTS_HREF)).toBe(false);

		const rominaLinks = buildInvitationStylesheetHeadLinks({
			plan: [],
			profileIdentity: { visualProfileId: 'romina-rios-chaparro' },
		});
		expect(rominaLinks).toEqual(
			expect.arrayContaining([
				{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
				{
					rel: 'stylesheet',
					href: PARISIENNE_GOOGLE_FONTS_HREF,
					media: DEFERRED_INVITATION_CSS_MEDIA,
					deferredCss: true,
				},
			]),
		);
	});

	it('promotes every invitation stylesheet when the envelope is skipped', () => {
		const links = buildInvitationStylesheetHeadLinks({
			presetUrl: '/_astro/premiere-floral-preset.css',
			plan,
			profileIdentity: { visualProfileId: 'romina-rios-chaparro' },
			forceBlocking: true,
		});

		expect(links.every((link) => !link.deferredCss && link.media === undefined)).toBe(true);
		expect(links.some((link) => link.href === PARISIENNE_GOOGLE_FONTS_HREF)).toBe(true);
		expect(links.filter((link) => link.rel === 'stylesheet').map((link) => link.href)).toEqual([
			'/_astro/premiere-floral-preset.css',
			'/_astro/editorial-bundle.css',
			'/_astro/reveal-premiere-floral.css',
			'/_astro/family-split-groups.css',
			'/_astro/renata-profile.css',
			PARISIENNE_GOOGLE_FONTS_HREF,
		]);
	});
});
