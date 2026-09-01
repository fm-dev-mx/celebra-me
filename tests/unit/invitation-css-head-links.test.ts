import {
	buildInvitationStylesheetHeadLinks,
	DEFERRED_INVITATION_CSS_MEDIA,
} from '@/lib/invitation/invitation-css-head-links';
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

	it('promotes every invitation stylesheet when the envelope is skipped', () => {
		const links = buildInvitationStylesheetHeadLinks({
			presetUrl: '/_astro/premiere-floral-preset.css',
			plan,
			forceBlocking: true,
		});

		expect(links.every((link) => !link.deferredCss && link.media === undefined)).toBe(true);
		expect(links.map((link) => link.href)).toEqual([
			'/_astro/premiere-floral-preset.css',
			'/_astro/editorial-bundle.css',
			'/_astro/reveal-premiere-floral.css',
			'/_astro/family-split-groups.css',
			'/_astro/renata-profile.css',
		]);
	});
});
