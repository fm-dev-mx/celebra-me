import { readFileSync } from 'node:fs';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { resolveEnvelopeDataVariant } from '@/lib/invitation/reveal-card';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
} from '@/lib/invitation/section-css-resolver-map';
import { resolveInvitationCssUrls } from '../helpers/invitation-css-urls';

describe('celestial-letter reveal contract', () => {
	it('accepts the celestial letter reveal variant and rejects look-alikes', () => {
		expect(envelopeSchema.safeParse({ revealVariant: 'celestial-letter' }).success).toBe(true);
		expect(envelopeSchema.safeParse({ revealVariant: 'celestial' }).success).toBe(false);
	});

	it('owns the envelope data-variant over the theme preset', () => {
		expect(resolveEnvelopeDataVariant('celestial-letter', 'celestial-blue')).toBe(
			'celestial-letter',
		);
	});

	it('loads the celestial letter stylesheet independently of the theme bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_celestial-letter.scss': {
				default: '/_astro/reveal-celestial-letter.css',
			},
			'/src/styles/themes/sections/reveal/_shared-light.scss': {
				default: '/_astro/reveal-shared-light.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'celestial-blue',
				envelopeVariant: 'celestial-letter',
			}),
		).toEqual(['/_astro/celestial-bundle.css', '/_astro/reveal-celestial-letter.css']);
	});

	it('keeps the card-rise hook and puts the letter inside the pocket', () => {
		const skin = readFileSync(
			'src/styles/themes/sections/reveal/_celestial-letter.scss',
			'utf8',
		);
		// EnvelopeReveal hands over on the `envCardRise*` animationend.
		expect(skin).toMatch(/@keyframes envCardRise\w+/);
		const reveal = readFileSync('src/components/invitation/EnvelopeReveal.astro', 'utf8');
		expect(reveal).toMatch(/letterInPocket = [^;]*isCelestialLetter/);
	});
});
