import fs from 'node:fs';
import path from 'node:path';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { countdownSchema } from '@/lib/schemas/content/shared.schema';
import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';
import { resolveIconComponent } from '@/components/common/icons/registry';
import { resolveCountdownDayLabel } from '@/lib/invitation/countdown-presentation';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	SEAL_ICON_MAP,
	resolveEnvelopeDataVariant,
	resolveSealStructure,
} from '@/lib/invitation/reveal-card';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
} from '@/lib/invitation/section-css-resolver-map';
import { resolveInvitationCssUrls } from '../helpers/invitation-css-urls';

const projectRoot = process.cwd();

describe('storybook-lanterns reveal contract', () => {
	it('accepts the storybook reveal variant and sunburst seal, rejecting unknown values', () => {
		expect(
			envelopeSchema.safeParse({
				revealVariant: 'storybook-lanterns',
				sealIcon: 'sunburst',
				sealInitials: 'A',
			}).success,
		).toBe(true);
		expect(envelopeSchema.safeParse({ revealVariant: 'storybook' }).success).toBe(false);
		expect(envelopeSchema.safeParse({ sealIcon: 'sun' }).success).toBe(false);
	});

	it('renders the sunburst seal as a vector icon backed by a registered component', () => {
		expect(resolveSealStructure({ sealIcon: 'sunburst', sealInitials: 'A' })).toEqual({
			renderer: 'vector-icon',
			icon: 'sunburst',
			initials: 'A',
		});
		expect(resolveIconComponent(SEAL_ICON_MAP.sunburst)).not.toBeNull();
	});

	it('owns the envelope data-variant as a standalone reveal', () => {
		expect(resolveEnvelopeDataVariant('storybook-lanterns', 'storybook-lilac')).toBe(
			'storybook-lanterns',
		);
	});

	it('loads the storybook reveal stylesheet next to the preset bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/storybook-lilac.scss': {
				default: '/_astro/storybook-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_storybook-lanterns.scss': {
				default: '/_astro/reveal-storybook-lanterns.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'storybook-lilac',
				envelopeVariant: 'storybook-lanterns',
			}),
		).toEqual(['/_astro/storybook-bundle.css', '/_astro/reveal-storybook-lanterns.css']);
	});
});

describe('storybook presentation contracts', () => {
	it('registers the storybook-lilac preset and its stylesheet entrypoints', () => {
		expect(THEME_PRESETS).toContain('storybook-lilac');
		for (const relativePath of [
			'src/styles/themes/presets/_storybook-lilac.scss',
			'src/styles/invitation-presets/storybook-lilac.scss',
			'src/styles/invitation-sections-by-preset/storybook-lilac.scss',
			'src/styles/themes/sections/reveal/_storybook-lanterns.scss',
		]) {
			expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true);
		}
	});

	it('accepts the storybook ornament set', () => {
		expect(
			invitationCompositionSchema.parse({ ornaments: 'storybook-lanterns' }).ornaments,
		).toBe('storybook-lanterns');
	});

	it('keeps the lantern drift behind the reduced-motion preference', () => {
		const ornaments = fs.readFileSync(
			path.join(projectRoot, 'src/styles/invitation/_ornament-sets.scss'),
			'utf8',
		);
		const fieldMixin = ornaments.slice(ornaments.indexOf('@mixin storybook-lantern-field'));
		expect(fieldMixin.slice(0, fieldMixin.indexOf('@keyframes'))).toContain(
			'@media (prefers-reduced-motion: no-preference)',
		);
	});

	it('counts nights only when requested', () => {
		expect(resolveCountdownDayLabel(undefined)).toBe('Días');
		expect(resolveCountdownDayLabel('days')).toBe('Días');
		expect(resolveCountdownDayLabel('nights')).toBe('Noches');
		const base = { variant: 'written-days' as const };
		expect(
			countdownSchema.parse({ ...base, presentationOptions: { dayUnit: 'nights' } })
				?.presentationOptions?.dayUnit,
		).toBe('nights');
		expect(() =>
			countdownSchema.parse({ ...base, presentationOptions: { dayUnit: 'weeks' } }),
		).toThrow();
	});
});
