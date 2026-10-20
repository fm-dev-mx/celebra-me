import { readFileSync } from 'node:fs';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { resolveEnvelopeDataVariant } from '@/lib/invitation/reveal-card';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
} from '@/lib/invitation/section-css-resolver-map';
import { resolveInvitationCssUrls } from '../helpers/invitation-css-urls';

describe('night-envelope reveal contract', () => {
	it('accepts the night envelope reveal variant and rejects look-alikes', () => {
		expect(envelopeSchema.safeParse({ revealVariant: 'night-envelope' }).success).toBe(true);
		expect(envelopeSchema.safeParse({ revealVariant: 'night' }).success).toBe(false);
	});

	it('owns the envelope data-variant over the theme preset', () => {
		expect(resolveEnvelopeDataVariant('night-envelope', 'jewelry-box-wedding')).toBe(
			'night-envelope',
		);
	});

	it('loads the night envelope stylesheet independently of the theme bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box-wedding.scss': {
				default: '/_astro/jewelry-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_night-envelope.scss': {
				default: '/_astro/reveal-night-envelope.css',
			},
			'/src/styles/themes/sections/reveal/_shared-light.scss': {
				default: '/_astro/reveal-shared-light.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'jewelry-box-wedding',
				envelopeVariant: 'night-envelope',
			}),
		).toEqual(['/_astro/jewelry-bundle.css', '/_astro/reveal-night-envelope.css']);
	});

	it('keeps the card-rise hook and a seal that never breaks', () => {
		const skin = readFileSync('src/styles/themes/sections/reveal/_night-envelope.scss', 'utf8');
		// EnvelopeReveal hands over on the `envCardRise*` animationend.
		expect(skin).toMatch(/@keyframes envCardRise\w+/);
		expect(skin).not.toMatch(/crack|shatter|split/i);
	});
});
