import { readFileSync } from 'node:fs';
import { locationSchema } from '@/lib/schemas/content/location.schema';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
} from '@/lib/invitation/section-css-resolver-map';
import { resolveInvitationCssUrls } from '../helpers/invitation-css-urls';
import celestialDemo from '@/invitations/demos/demo-xv-celestial-blue/content.json';

const venue = (venueEvent: string, time: string, type: 'ceremony' | 'reception') => ({
	type,
	venueEvent,
	venueName: `${venueEvent} venue`,
	address: 'Av. Morelos 105, Centro, Cuernavaca',
	city: 'Cuernavaca',
	date: '12 de septiembre de 2027',
	time,
	isVisible: true,
});

describe('location star-route contract', () => {
	it('accepts two visible venues and rejects a single one', () => {
		const twoVenues = {
			variant: 'star-route',
			venues: [
				venue('Misa', '5:00 PM', 'ceremony'),
				venue('Recepción', '7:00 PM', 'reception'),
			],
		};
		expect(locationSchema.safeParse(twoVenues).success).toBe(true);
		expect(
			locationSchema.safeParse({
				...twoVenues,
				venues: [venue('Misa', '5:00 PM', 'ceremony')],
			}).success,
		).toBe(false);
	});

	it('is the variant of the Celestial XV demo', () => {
		const parsed = locationSchema.safeParse(celestialDemo.location);
		expect(parsed.success).toBe(true);
		expect(parsed.data?.variant).toBe('star-route');
	});

	it('loads its own stylesheet independently of the theme bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/location/_star-route.scss': {
				default: '/_astro/location-star-route.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'celestial-blue',
				sectionVariants: { location: 'star-route' },
			}),
		).toContain('/_astro/location-star-route.css');
	});

	it('moves the intro lede to the footnote instead of the header', () => {
		const location = readFileSync('src/components/invitation/EventLocation.astro', 'utf8');
		expect(location).toMatch(/headerLede = isStarRoute \? undefined : introLede/);
		expect(location).toMatch(
			/isStarRoute && introLede && <p class="event-location__footnote">/,
		);
	});
});
