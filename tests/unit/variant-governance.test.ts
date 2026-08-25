import fs from 'node:fs';
import path from 'node:path';
import {
	CANONICAL_VARIANT_CUTOVER_MANIFEST,
	CANONICAL_VARIANT_REGISTRY,
} from '@/lib/invitation/section-variants';

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

const originIdentity =
	/romina|rios|chaparro|alba|quinonez|daniela|martin|victoria|roberto|abril|michelle|becerra|valentina|xareni/iu;

const normalizeManifestCell = (value: string) => value.replaceAll('`', '').replace(/\s+/gu, ' ').trim();

function readCutoverManifestRows() {
	return read('docs/domains/theme/variant-cutover-manifest.md')
		.split(/\r?\n/u)
		.filter((line) => line.startsWith('| `'))
		.map((line) => line.split('|').slice(1, -1).map(normalizeManifestCell));
}

const canonicalVariantRenderers = [
	'src/components/invitation/Hero.astro',
	'src/components/invitation/EditorialCoverHero.astro',
	'src/components/invitation/Family.astro',
	'src/components/invitation/EventLocation.astro',
	'src/components/invitation/Gallery.astro',
	'src/components/invitation/PhotoGallery.astro',
	'src/components/invitation/GalleryLightbox.astro',
	'src/components/invitation/Itinerary.astro',
	'src/components/invitation/Countdown.astro',
	'src/components/invitation/Gifts.astro',
	'src/components/invitation/LockedRsvpPreview.astro',
	'src/components/invitation/ThankYou.astro',
	'src/components/invitation/PersonalizedAccess.astro',
	'src/components/invitation/Quote.astro',
] as const;
describe('canonical variant governance', () => {
	it('keeps documentation synchronized with the closed variant vocabulary', () => {
		const inventory = read('docs/domains/theme/variant-system.md');
		const compatibility = read('docs/domains/theme/variant-compatibility.md');
		const creationContract = read('docs/core/invitation-creation-contract.md');
		const rominaReference = read('docs/invitations/romina-rios-chaparro.md');
		const manifestRows = readCutoverManifestRows();

		for (const { variant: identifier } of CANONICAL_VARIANT_REGISTRY) {
			expect(inventory).toContain(identifier);
		}

		expect(manifestRows).toHaveLength(CANONICAL_VARIANT_CUTOVER_MANIFEST.length);
		expect(manifestRows).toEqual(
			CANONICAL_VARIANT_CUTOVER_MANIFEST.map((entry) => [
				`${entry.section}.${entry.variant}`,
				entry.prerequisites.join(', '),
				entry.cssOwner,
				entry.unresolvedVisualVerification,
				entry.requiredPersistedContentTransformation,
			]),
		);

		expect(compatibility).toContain('Removed compatibility inputs');
		expect(compatibility).toContain('Deployment blocked');
		expect(compatibility).toContain('rejected rather than converted');

		expect(inventory).toContain(
			'Invitation source → canonical schema → adapter → render plan → section DOM + isolated CSS',
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
		for (const { cssOwner: relativePath } of CANONICAL_VARIANT_REGISTRY.filter((entry) =>
			entry.cssOwner.startsWith('src/'),
		)) {
			expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(true);
			const source = read(relativePath);
			expect(source).toContain('data-variant');
			expect(source).not.toMatch(originIdentity);
			expect(source).not.toMatch(/invitation-profiles|assets\/images\/events/iu);
		}
	});

	it('keeps structural CSS dispatch semantic and separate from visual preset dispatch', () => {
		const resolver = read('src/lib/invitation/section-css-resolver-map.ts');
		expect(resolver).toContain('CANONICAL_VARIANT_REGISTRY');
		expect(resolver).not.toContain('STRUCTURAL_VARIANT_TO_ENTRYPOINT');
		expect(resolver).not.toMatch(originIdentity);
		const sectionDispatch = resolver.slice(resolver.indexOf('function resolveSectionVariantLoadItems'));
		expect(sectionDispatch).not.toMatch(/slug|visualProfileId/);
	});

	it('has no runtime variant normalizer or compatibility aliases', () => {
		const consumers = listFiles('src')
			.filter((relativePath) => /\.(?:ts|tsx|astro)$/u.test(relativePath))
			.filter((relativePath) =>
				read(relativePath).includes('normalizeInvitationVariantInput'),
			)
			.sort();

		expect(consumers).toEqual([]);
		for (const relativePath of [
			'src/lib/adapters/types.ts',
			'src/lib/adapters/event.ts',
			'src/lib/schemas/content/base-event.schema.ts',
			'src/lib/schemas/content/interludes.schema.ts',
			'src/lib/intake/mappers/draft-to-published.mapper.ts',
			'src/lib/invitation/render-plan.ts',
			'src/lib/invitation/section-render-data.ts',
		]) {
			const source = read(relativePath);
			expect(source).not.toMatch(
				/structuralVariant|visualVariant|sectionStyles|presentation\.behavior|ITINERARY_(?:BEHAVIOR|PRESENTATION)/,
			);
		}
		expect(fs.existsSync(path.join(process.cwd(), 'src/lib/invitation/itinerary-presentation.ts'))).toBe(
			false,
		);
	});

	it('requires canonical section renderers to receive variants explicitly', () => {
		for (const relativePath of canonicalVariantRenderers) {
			const source = read(relativePath);
			expect(source).not.toMatch(/variant\?:/u);
			expect(source).not.toMatch(/variant\s*=\s*['"][^'"]+['"]/u);
		}
	});

	it('propagates canonical variants to an explicit DOM contract', () => {
		for (const relativePath of reusableRendererSurfaces) {
			expect(read(relativePath)).toContain('data-variant');
		}
	});

	it('keeps formal-pass and formal-register geometry in the variants instead of client profiles', () => {
		const formalPass = read('src/styles/themes/sections/personalized-access/_formal-pass.scss');
		const formalRegister = read('src/styles/themes/sections/rsvp/_formal-register.scss');
		const victoria = read('src/styles/invitation-profiles/victoria-y-roberto.scss');
		const renata = read('src/styles/invitation-profiles/renata.scss');

		expect(formalPass).toContain("data-variant='formal-pass'");
		expect(formalPass).toContain('--formal-chapter-band');
		expect(formalPass).toContain('.access-card');
		expect(formalRegister).toContain("data-variant='formal-register'");
		expect(formalRegister).toContain('--formal-chapter-band');
		expect(formalRegister).toContain('.rsvp__radio-card');
		expect(formalRegister).toContain(
			".rsvp-section:has(.rsvp[data-variant='formal-register'])",
		);
		expect(formalRegister).not.toContain(
			".rsvp-section:has(> .rsvp[data-variant='formal-register'])",
		);
		expect(formalRegister).toMatch(/\.rsvp__title[\s\S]*letter-spacing:\s*normal/);

		for (const profile of [victoria, renata]) {
			expect(profile).not.toMatch(/data-variant=['"]formal-pass/);
			expect(profile).not.toMatch(/data-variant=['"]formal-register/);
			expect(profile).not.toMatch(/@use .*formal-pass|@use .*formal-register/);
			expect(profile).not.toContain('.access-card');
			expect(profile).not.toContain('.rsvp__radio-card');
		}
	});

	it('keeps split-cover geometry in the variant instead of the Romina profile', () => {
		const variant = read('src/styles/themes/sections/hero/_split-cover.scss');
		const profile = read('src/styles/invitation-profiles/romina-rios-chaparro.scss');

		expect(variant).toMatch(/respond-to\(lg\)|width\s*>=\s*992px/u);
		expect(variant).toContain('--hero-split-title-size');
		expect(variant).toContain('.invitation-hero__content');
		// Profile may reassert title tokens on [data-variant=split-cover]; not geometry.
		expect(profile).not.toMatch(/@use .*hero\/split-cover/);
		expect(profile).not.toMatch(/grid-template|display:\s*none/);
		expect(profile).not.toContain('--hero-split-photo-width');
		expect(profile).not.toContain('--hero-split-content-width');
	});

	it('keeps typed composition and shared maps free of runtime identity selection', () => {
		const composition = read('src/lib/invitation/composition-contract.ts');
		const renderPlan = read('src/lib/invitation/render-plan.ts');
		const googleMap = read('src/components/common/GoogleMap.astro');

		expect(composition).not.toMatch(originIdentity);
		expect(renderPlan).not.toMatch(/visualProfileId|eventSlug|slug/);
		expect(googleMap).not.toContain("variant === 'romina-rios-chaparro'");
		expect(googleMap).not.toContain('<iframe');
		expect(googleMap).not.toContain('output=embed');
		expect(googleMap).toContain('data-map-preview="static"');
		expect(
			fs.existsSync(path.join(process.cwd(), 'src/lib/invitation/intersection-profiles.ts')),
		).toBe(false);
	});

	it('keeps temporary parity checkouts out of Jest configuration', () => {
		expect(read('jest.config.cjs')).not.toContain('.tmp/');
	});
});
