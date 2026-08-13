import fs from 'node:fs';
import path from 'node:path';
import {
	FAMILY_STRUCTURAL_VARIANTS,
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	HERO_STRUCTURAL_VARIANTS,
	ITINERARY_STRUCTURAL_VARIANTS,
	LOCATION_STRUCTURAL_VARIANTS,
	PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
	RSVP_STRUCTURAL_VARIANTS,
	THANK_YOU_STRUCTURAL_VARIANTS,
} from '@/lib/invitation/structural-variants';
import { VARIANT_COMPATIBILITY_ALIASES } from '@/lib/invitation/variant-normalization';

const read = (relativePath: string) =>
	fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const toPosix = (filePath: string) => filePath.replaceAll('\\', '/');

function listFiles(relativeDirectory: string): string[] {
	const absoluteDirectory = path.join(process.cwd(), relativeDirectory);
	return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
		const relativePath = path.join(relativeDirectory, entry.name);
		return entry.isDirectory() ? listFiles(relativePath) : [toPosix(relativePath)];
	});
}

const reusableRendererSurfaces = [
	'src/components/invitation/Hero.astro',
	'src/components/invitation/EditorialCoverHero.astro',
	'src/components/invitation/EventLocation.astro',
	'src/components/invitation/Family.astro',
	'src/components/invitation/Gallery.astro',
	'src/components/invitation/PhotoGallery.astro',
	'src/components/invitation/Itinerary.astro',
	'src/components/invitation/Gifts.astro',
	'src/components/invitation/RSVPComponents.tsx',
	'src/components/invitation/PersonalizedAccess.astro',
	'src/components/invitation/ThankYou.astro',
] as const;

const canonicalVariantCss = [
	'src/styles/themes/sections/hero/_editorial-cover.scss',
	'src/styles/themes/sections/hero/_split-cover.scss',
	'src/styles/themes/sections/family/_split-groups.scss',
	'src/styles/themes/sections/family/_asymmetric-groups.scss',
	'src/styles/themes/sections/location/_split-map.scss',
	'src/styles/themes/sections/location/_stacked-venue-plates.scss',
	'src/styles/themes/sections/gallery/_editorial-mosaic.scss',
	'src/styles/themes/sections/gallery/_magazine-spread.scss',
	'src/styles/themes/sections/gallery/_feature-mosaic.scss',
	'src/styles/themes/sections/gallery/_feature-stack.scss',
	'src/styles/themes/sections/gallery/_paired-feature-band.scss',
	'src/styles/themes/sections/gallery/_index-choreography.scss',
	'src/styles/themes/sections/itinerary/_timeline-paper.scss',
	'src/styles/themes/sections/itinerary/_editorial-ledger.scss',
	'src/styles/themes/sections/gifts/_editorial-catalog.scss',
	'src/styles/themes/sections/rsvp/_editorial-press-pass.scss',
	'src/styles/themes/sections/personalized-access/_editorial-pass.scss',
	'src/styles/themes/sections/thank-you/_editorial-back-cover.scss',
	'src/styles/themes/sections/thank-you/_full-bleed-photo.scss',
] as const;

const originIdentity =
	/romina|rios|chaparro|alba|quinonez|daniela|martin|victoria|roberto|abril|michelle|becerra|valentina|xareni/iu;
const historicalThemeIdentity =
	/premiere-floral|editorial-magazine|luxury-hacienda|celestial-blue/iu;

describe('canonical variant governance', () => {
	it('keeps documentation synchronized with the closed variant vocabulary', () => {
		const inventory = read('docs/domains/theme/variant-system.md');
		const compatibility = read('docs/domains/theme/variant-compatibility.md');
		const creationContract = read('docs/core/invitation-creation-contract.md');
		const rominaReference = read('docs/invitations/romina-rios-chaparro.md');

		for (const identifier of [
			...HERO_STRUCTURAL_VARIANTS,
			...FAMILY_STRUCTURAL_VARIANTS,
			...LOCATION_STRUCTURAL_VARIANTS,
			...GALLERY_LAYOUT_VARIANTS,
			...ITINERARY_STRUCTURAL_VARIANTS,
			...GIFTS_STRUCTURAL_VARIANTS,
			...RSVP_STRUCTURAL_VARIANTS,
			...PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
			...THANK_YOU_STRUCTURAL_VARIANTS,
		]) {
			expect(inventory).toContain(identifier);
		}

		for (const alias of VARIANT_COMPATIBILITY_ALIASES) {
			expect(compatibility).toContain(alias.legacy);
			expect(compatibility).toContain(alias.target);
		}

		expect(inventory).toContain(
			'Invitation configuration → section-owned typed variant → renderer + isolated variant SCSS → shared primitives',
		);
		expect(creationContract).toContain(
			'A reusable variant may originate during invitation work',
		);
		expect(rominaReference).toContain('Romina is the approved reference');
	});

	it('keeps reusable renderers independent from invitation identity', () => {
		for (const relativePath of reusableRendererSurfaces) {
			const source = read(relativePath);
			expect(source).not.toMatch(originIdentity);
			expect(source).not.toMatch(/visualProfileId|_assetSlug|assets\/images\/events/iu);
			expect(source).not.toMatch(/resolveInvitationVariant|normalizeInvitationVariantInput/);
		}
	});

	it('keeps reusable invitation components free from client-derived identities', () => {
		const componentSurfaces = listFiles('src/components/invitation').filter((relativePath) =>
			/\.(?:astro|ts|tsx)$/u.test(relativePath),
		);

		for (const relativePath of componentSurfaces) {
			expect(relativePath).not.toMatch(originIdentity);
			expect(read(relativePath)).not.toMatch(originIdentity);
		}
	});

	it('uses semantic, section-owned CSS entrypoints with no origin dependency', () => {
		for (const relativePath of canonicalVariantCss) {
			expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(true);
			const source = read(relativePath);
			expect(source).toContain('data-structural-variant');
			expect(source).not.toMatch(originIdentity);
			expect(source).not.toMatch(historicalThemeIdentity);
			expect(source).not.toMatch(/invitation-profiles|assets\/images\/events/iu);
		}
	});

	it('keeps structural CSS dispatch semantic and separate from visual preset dispatch', () => {
		const resolver = read('src/lib/invitation/section-css-resolver-map.ts');
		const structuralMap = resolver.slice(
			resolver.indexOf('const STRUCTURAL_VARIANT_TO_ENTRYPOINT'),
			resolver.indexOf('// Only presets with a dedicated footer'),
		);
		const galleryMap = resolver.slice(
			resolver.indexOf('const GALLERY_VARIANT_TO_ENTRYPOINT'),
			resolver.indexOf('const STRUCTURAL_VARIANT_TO_ENTRYPOINT'),
		);

		expect(structuralMap).toContain("'split-cover': 'split-cover'");
		expect(structuralMap).toContain("'timeline-paper': 'timeline-paper'");
		expect(structuralMap).toContain("'editorial-ledger': 'editorial-ledger'");
		expect(structuralMap).toContain("'stacked-venue-plates': 'stacked-venue-plates'");
		expect(structuralMap).toContain("'asymmetric-groups': 'asymmetric-groups'");
		expect(galleryMap).toContain("'feature-stack': 'feature-stack'");
		expect(galleryMap).toContain("'paired-feature-band': 'paired-feature-band'");
		expect(structuralMap).not.toMatch(originIdentity);
		expect(structuralMap).not.toMatch(historicalThemeIdentity);
		expect(structuralMap).not.toMatch(/slug|visualProfileId|themePreset/);
	});

	it('normalizes compatibility through one implementation boundary only', () => {
		const consumers = listFiles('src')
			.filter((relativePath) => /\.(?:ts|tsx|astro)$/u.test(relativePath))
			.filter((relativePath) =>
				read(relativePath).includes('normalizeInvitationVariantInput'),
			)
			.sort();

		expect(consumers).toEqual([
			'src/lib/adapters/event.ts',
			'src/lib/intake/services/draft-content-mapper.ts',
			'src/lib/invitation/variant-normalization.ts',
			'src/lib/schemas/content/base-event.schema.ts',
		]);
	});

	it('propagates canonical variants to an explicit DOM contract', () => {
		for (const relativePath of reusableRendererSurfaces) {
			expect(read(relativePath)).toContain('data-structural-variant');
		}
	});

	it('keeps split-cover geometry in the variant instead of the Romina profile', () => {
		const variant = read('src/styles/themes/sections/hero/_split-cover.scss');
		const profile = read('src/styles/invitation-profiles/romina-rios-chaparro.scss');

		expect(variant).toMatch(/respond-to\(lg\)|width\s*>=\s*992px/u);
		expect(variant).toContain('--hero-split-title-size');
		expect(variant).toContain('.invitation-hero__content');
		expect(profile).not.toMatch(/data-structural-variant=['"]split-cover/);
		expect(profile).not.toMatch(/@use .*hero\/split-cover/);
		expect(profile).not.toMatch(/grid-template|display:\s*none/);
	});

	it('keeps typed composition and shared maps free of runtime identity selection', () => {
		const composition = read('src/lib/invitation/composition-contract.ts');
		const renderPlan = read('src/lib/invitation/render-plan.ts');
		const googleMap = read('src/components/common/GoogleMap.astro');

		expect(composition).not.toMatch(originIdentity);
		expect(renderPlan).not.toMatch(/visualProfileId|eventSlug|slug/);
		expect(googleMap).not.toContain("variant === 'romina-rios-chaparro'");
		expect(
			fs.existsSync(path.join(process.cwd(), 'src/lib/invitation/intersection-profiles.ts')),
		).toBe(false);
	});

	it('keeps temporary parity checkouts out of Jest configuration', () => {
		expect(read('jest.config.cjs')).not.toContain('.tmp/');
	});
});
