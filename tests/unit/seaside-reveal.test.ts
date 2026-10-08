import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';
import { interludeSchema } from '@/lib/schemas/content/interludes.schema';
import { resolveIconComponent } from '@/components/common/icons/registry';
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

describe('seaside-lineart reveal contract', () => {
	it('accepts the seaside reveal variant and shell seal, rejecting unknown values', () => {
		expect(
			envelopeSchema.safeParse({ revealVariant: 'seaside-lineart', sealIcon: 'shell' })
				.success,
		).toBe(true);
		expect(envelopeSchema.safeParse({ revealVariant: 'seaside' }).success).toBe(false);
		expect(envelopeSchema.safeParse({ sealIcon: 'conch' }).success).toBe(false);
	});

	it('renders the shell seal as a vector icon backed by a registered component', () => {
		expect(resolveSealStructure({ sealIcon: 'shell' })).toEqual({
			renderer: 'vector-icon',
			icon: 'shell',
			initials: undefined,
		});
		expect(resolveIconComponent(SEAL_ICON_MAP.shell)).not.toBeNull();
	});

	it('lets standalone reveal variants own the envelope data-variant', () => {
		expect(resolveEnvelopeDataVariant('seaside-lineart', 'celestial-blue')).toBe(
			'seaside-lineart',
		);
		expect(resolveEnvelopeDataVariant('satin-filigree', 'celestial-blue')).toBe(
			'satin-filigree',
		);
		expect(resolveEnvelopeDataVariant('editorial-cover', 'celestial-blue')).toBe(
			'celestial-blue',
		);
		expect(resolveEnvelopeDataVariant(undefined, 'jewelry-box')).toBe('jewelry-box');
	});

	it('loads the seaside reveal stylesheet independently of the theme bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_seaside-lineart.scss': {
				default: '/_astro/reveal-seaside-lineart.css',
			},
			'/src/styles/themes/sections/reveal/_shared-light.scss': {
				default: '/_astro/reveal-shared-light.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'celestial-blue',
				envelopeVariant: 'seaside-lineart',
			}),
		).toEqual(['/_astro/celestial-bundle.css', '/_astro/reveal-seaside-lineart.css']);
	});

	it('registers the marine icons', () => {
		for (const name of ['Seashell', 'Starfish', 'Wave', 'ShellSeal']) {
			expect(resolveIconComponent(name)).not.toBeNull();
		}
	});
});

describe('seaside presentation contracts', () => {
	it('accepts the seaside ornament set and rejects unknown sets', () => {
		expect(invitationCompositionSchema.parse({ ornaments: 'seaside-lineart' }).ornaments).toBe(
			'seaside-lineart',
		);
		expect(() => invitationCompositionSchema.parse({ ornaments: 'gold-filigree' })).toThrow();
	});

	it('keeps interludes full-bleed unless framed is requested', () => {
		const base = { image: 'gallery01', afterSection: 'countdown' };
		expect(interludeSchema.parse(base).presentation).toBeUndefined();
		expect(interludeSchema.parse({ ...base, presentation: 'framed' }).presentation).toBe(
			'framed',
		);
	});
});
