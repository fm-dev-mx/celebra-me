import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

/** Extract all @forward names from a section _index.scss */
function getForwardedPartials(sectionDir: string): string[] {
	const index = read(`${sectionDir}/_index.scss`);
	const matches = [...index.matchAll(/@forward\s+'([^']+)'/g)];
	return matches.map((m) => m[1]);
}

/** List existing variant partials (files matching _<name>.scss, excluding _index) */
function getExistingPartials(sectionDir: string): string[] {
	const absoluteDir = path.join(projectRoot, sectionDir);
	if (!fs.existsSync(absoluteDir)) return [];
	return fs
		.readdirSync(absoluteDir)
		.filter((f) => f.startsWith('_') && f.endsWith('.scss') && f !== '_index.scss')
		.map((f) => f.replace(/^_|\.scss$/g, ''));
}

function getPresetBundleImports(section: string): string[] {
	const bundleDir = 'src/styles/invitation-sections-by-preset';
	const absoluteDir = path.join(projectRoot, bundleDir);
	if (!fs.existsSync(absoluteDir)) return [];

	const importPattern = new RegExp(`@use\\s+'\\.\\./themes/sections/${section}/([^']+)'`, 'g');
	const imports = fs
		.readdirSync(absoluteDir)
		.filter((f) => f.endsWith('.scss'))
		.flatMap((file) => {
			const content = read(`${bundleDir}/${file}`);
			return [...content.matchAll(importPattern)].map((match) => match[1]);
		});

	return [...new Set(imports)];
}

function getFilesRecursively(dir: string, extensions: string[]): string[] {
	const absoluteDir = path.join(projectRoot, dir);
	if (!fs.existsSync(absoluteDir)) return [];

	return fs
		.readdirSync(absoluteDir, { recursive: true })
		.filter((file): file is string => typeof file === 'string')
		.filter((file) => extensions.some((ext) => file.endsWith(ext)))
		.map((file) => path.join(dir, file).replace(/\\/g, '/'));
}

const PA_PRESET_NAMES = [
	'editorial',
	'premiere-floral',
	'jewelry-box',
	'jewelry-box-wedding',
	'celestial-blue',
	'enchanted-rose',
	'luxury-hacienda',
	'angelic-presence',
	'sacred-keepsake',
];

const PA_REQUIRED_VARS = [
	'--pa-card-border',
	'--pa-card-bg-image',
	'--pa-card-shadow',
	'--pa-card-glow',
	'--pa-card-inner-border',
	'--pa-card-inner-radius',
	'--pa-corner-opacity',
	'--pa-corner-glow-blur',
	'--pa-eyebrow-color',
	'--pa-eyebrow-tracking',
	'--pa-title-font',
	'--pa-title-tracking',
	'--pa-title-color',
	'--pa-guest-weight',
	'--pa-guest-color',
	'--pa-divider-gradient',
	'--pa-divider-opacity',
	'--pa-divider-diamond-bg',
	'--pa-divider-diamond-border-color',
	'--pa-divider-diamond-shadow',
	'--pa-count-frame-radius',
	'--pa-count-frame-border',
	'--pa-count-frame-bg',
	'--pa-count-frame-shadow',
	'--pa-count-color',
	'--pa-footer-border-top',
	'--pa-footer-text-color',
];

const FAMILY_REQUIRED_VARS = [
	'--family-bg',
	'--family-texture-opacity',
	'--family-vignette-bg',
	'--family-panel-bg',
	'--family-panel-border',
	'--family-panel-shadow',
	'--family-panel-radius',
	'--family-panel-spacing',
	'--family-content-gap',
	'--family-accent',
	'--family-text-primary',
	'--family-text-muted',
	'--family-divider',
	'--family-title-font',
	'--family-name-font',
	'--family-name-size',
	'--family-lead-name-size',
	'--family-media-bg',
	'--family-media-radius',
	'--family-media-border',
	'--family-media-shadow',
	'--family-media-inner-border',
	'--family-media-filter',
	'--family-focal-point',
	'--family-deceased-symbol-color',
	'--family-deceased-symbol-size',
	'--family-deceased-symbol-opacity',
	'--family-deceased-symbol-offset-y',
];

const FAMILY_RETIRED_SELECTORS_AND_VARS = [
	'family__connector',
	'family__pair',
	'family__pair-ordinal',
	'family__item-name',
	'family__item-relation',
	'family__paper-surface',
	'family__watermark',
	'--family-ledger-display',
	'--family-connector-size',
	'--family-connector-margin',
	'--family-parent-connector-width',
	'--family-pair-connector-size',
	'--family-pair-member-gap',
];

describe('Style boundary governance', () => {
	it('invitation-facing components do not hardcode hex colors in Astro or TSX files', () => {
		const invitationFiles = getFilesRecursively('src/components/invitation', [
			'.astro',
			'.tsx',
		]);
		const pageFiles = getFilesRecursively('src/pages/[eventType]/[slug]', ['.astro']);

		const commonFiles = [
			'src/components/common/GoogleMap.astro',
			'src/components/common/OptimizedImage.astro',
			'src/components/ui/Confetti.tsx',
		];

		const allFiles = [...invitationFiles, ...pageFiles, ...commonFiles];

		for (const file of allFiles) {
			expect(read(file)).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
		}
	});

	it('styling-only Astro components avoid style define:vars blocks', () => {
		const commonFiles = getFilesRecursively('src/components/common', ['.astro']);
		const layoutFiles = getFilesRecursively('src/components/layout', ['.astro']);
		const rootPages = ['src/pages/[eventType]/[slug].astro'];

		const allFiles = [...commonFiles, ...layoutFiles, ...rootPages];

		for (const file of allFiles) {
			expect(read(file)).not.toMatch(/<style[^>]*define:vars=/);
		}
	});

	it('global.scss does not import invitation or dashboard domains directly', () => {
		const globalScss = read('src/styles/global.scss');
		expect(globalScss).not.toContain("@use 'dashboard/");
		expect(globalScss).not.toContain("@use 'invitation/");
		expect(globalScss).not.toContain("@use 'themes/sections'");
	});

	it('shared invitation CSS excludes client profiles and inactive preset bases', () => {
		const invitationScss = read('src/styles/invitation.scss');
		const sectionIndex = read('src/styles/themes/sections/_index.scss');
		const sharedBase = read('src/styles/themes/sections/_base-theme.scss');
		const sharedSectionStyles = getFilesRecursively('src/styles/themes/sections', ['.scss'])
			.map(read)
			.join('\n');

		expect(invitationScss).toContain("@use 'themes/sections'");
		for (const profile of [
			'leah-lexa-rhythm',
			'luna-y-estrella',
			'xv-xareni-iyarit',
			'xv-america-johana',
			'xv-valentina-hernandez',
		]) {
			expect(sectionIndex).not.toContain(profile);
		}
		expect(sharedBase).not.toContain('.theme-preset--');
		expect(sharedBase).not.toContain('.event--');
		expect(sharedSectionStyles).not.toMatch(
			/\.event--(?:luna-y-estrella|leah-lexa|america-johana|xareni-iyarit|valentina-hernandez)\b/,
		);
	});

	it('preset section bundles import canonical modules without passthrough entrypoints', () => {
		const bundleFiles = getFilesRecursively('src/styles/invitation-sections-by-preset', [
			'.scss',
		]);

		expect(getFilesRecursively('src/styles/invitation-sections', ['.scss'])).toHaveLength(0);
		for (const file of bundleFiles) {
			expect(read(file)).not.toContain('../invitation-sections/');
		}

		const premiereFloral = read(
			'src/styles/invitation-sections-by-preset/premiere-floral.scss',
		);
		const editorialHeroImport =
			"@use '../themes/sections/hero/editorial' as hero-premiere-floral-editorial;";
		const premiereHeroImport =
			"@use '../themes/sections/hero/premiere-floral' as hero-premiere-floral;";

		expect(premiereFloral).toContain(editorialHeroImport);
		expect(premiereFloral).toContain(premiereHeroImport);
		expect(premiereFloral.indexOf(editorialHeroImport)).toBeLessThan(
			premiereFloral.indexOf(premiereHeroImport),
		);
	});

	it('footer override discovery targets only canonical footer variants', () => {
		const resolver = read('src/lib/invitation/section-css-resolver.ts');

		expect(resolver).not.toContain('/src/styles/invitation-sections/');
		for (const variant of [
			'angelic-presence',
			'editorial',
			'enchanted-rose',
			'premiere-floral',
		]) {
			expect(resolver).toContain(`/src/styles/themes/sections/footer/_${variant}.scss`);
		}
		expect(resolver).not.toContain('/src/styles/themes/sections/footer/*.scss');
	});

	it('invitation components avoid direct section-theme imports', () => {
		const invitationAstroFiles = getFilesRecursively('src/components/invitation', ['.astro']);

		for (const file of invitationAstroFiles) {
			const content = read(file);
			// Should not import specific section themes directly
			expect(content).not.toMatch(/themes\/sections\/_[a-z-]+\.scss/);
		}
	});

	it('dashboard guests styles live under dashboard domain', () => {
		const dashboardApp = read('src/components/dashboard/guests/GuestDashboardApp.tsx');
		expect(dashboardApp).toContain('@/styles/dashboard/_guests.scss');
		expect(dashboardApp).not.toContain('@/styles/invitation/_dashboard-guests.scss');
	});

	it('footer theme ownership stays out of the base invitation stylesheet', () => {
		const footerBase = read('src/styles/invitation/_footer.scss');
		const footerTheme = getFilesRecursively('src/styles/themes/sections/footer', ['.scss'])
			.map(read)
			.join('\n');
		const baseSectionFiles = [
			'src/styles/invitation/_footer.scss',
			'src/styles/invitation/_event-location.scss',
			'src/styles/invitation/_thank-you.scss',
		];

		expect(footerBase).not.toContain("[data-variant='editorial']");
		expect(footerBase).not.toContain('premiere-floral');
		expect(footerTheme).not.toContain("[data-variant='editorial']");
		expect(footerTheme).toContain('.theme-preset--editorial');
		expect(footerTheme).toContain('.theme-preset--premiere-floral');

		for (const file of baseSectionFiles) {
			expect(read(file)).not.toContain('premiere-floral');
		}
	});

	it('location enchanted-rose visuals live in a scoped section variant', () => {
		const sectionsIndex = read('src/styles/themes/sections/_index.scss');
		const locationIndex = read('src/styles/themes/sections/location/_index.scss');
		const locationBundleImports = getPresetBundleImports('location');
		const locationVariant = read('src/styles/themes/sections/location/_enchanted-rose.scss');

		expect(sectionsIndex).toContain("@forward 'location';");
		expect(locationIndex).toContain("@forward 'base';");
		expect(locationIndex).not.toContain("@forward 'enchanted-rose';");
		expect(locationBundleImports).toContain('enchanted-rose');
		expect(locationVariant).toContain('.theme-preset--enchanted-rose .event-location');
		expect(locationVariant).toContain('--location-er-frame-bg');
		expect(locationVariant).toContain(':focus-visible');
	});

	it('location section exposes editable heading copy and legacy hash alias', () => {
		const eventLocation = read('src/components/invitation/EventLocation.astro');
		const enchantedRoseDemo = read('src/content/event-demos/xv/demo-xv-enchanted-rose.json');

		expect(eventLocation).toContain('id="location"');
		expect(eventLocation).toContain('event-location__intro');
		expect(eventLocation).toContain('event-location__heading');
		expect(eventLocation).toContain('{introHeading}');
		expect(eventLocation).not.toContain("isEnchantedRose ? 'Ubicación'");
		expect(enchantedRoseDemo).toContain('"introHeading": "Ubicación"');
	});

	it('rsvp theme ownership stays out of the base invitation stylesheet', () => {
		const rsvpBase = read('src/styles/invitation/_rsvp.scss');
		const rsvpTheme = getFilesRecursively('src/styles/themes/sections/rsvp', ['.scss'])
			.map(read)
			.join('\n');

		expect(rsvpBase).not.toContain('.theme-preset--premiere-floral');
		expect(rsvpBase).not.toContain('.theme-preset--editorial');
		expect(rsvpTheme).toContain('.theme-preset--premiere-floral');
		expect(rsvpTheme).toContain('.theme-preset--editorial');
	});

	it('rsvp variant partials do not override structural layout tokens', () => {
		const structuralTokenPattern =
			/--rsvp-(?:section-padding|card-padding|card-margin|form-gap|grid-gap|radio-group-gap|radio-group-margin|radio-card-padding|textarea-(?:height|min-height)|title-size|title-margin|header-margin|input-padding|button-padding|bottom-clearance)\b/;
		const structuralRulePattern =
			/(?:min-height|height|padding|padding-block|padding-inline|margin|margin-block|gap):\s*var\(--rsvp-/;

		for (const file of getFilesRecursively('src/styles/themes/sections/rsvp', ['.scss'])) {
			if (file.endsWith('_base.scss')) continue;
			const content = read(file)
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*$/gm, '');

			expect(content).not.toMatch(structuralTokenPattern);
			expect(content).not.toMatch(structuralRulePattern);
		}
	});

	it('rsvp source tree does not keep redundant component or sourcemap artifacts', () => {
		expect(
			fs.existsSync(path.join(projectRoot, 'src/components/invitation/GuestRSVPForm.tsx')),
		).toBe(false);
		expect(
			fs.existsSync(path.join(projectRoot, 'src/components/invitation/GuestRSVPForm.astro')),
		).toBe(false);
		expect(
			fs.existsSync(
				path.join(projectRoot, 'src/components/invitation/GuestInvitationHero.astro'),
			),
		).toBe(false);
		expect(
			fs.existsSync(path.join(projectRoot, 'src/styles/invitation/_invitado-page.scss')),
		).toBe(false);
		expect(fs.existsSync(path.join(projectRoot, 'src/styles/invitation/_rsvp.css.map'))).toBe(
			false,
		);
	});

	it('music player theme skin lives in the base contract and presets', () => {
		const sectionIndex = read('src/styles/themes/sections/_index.scss');
		const musicBase = read('src/styles/invitation/_music-player.scss');

		expect(sectionIndex).not.toContain("@forward 'music'");
		expect(fs.existsSync(path.join(projectRoot, 'src/styles/themes/sections/music'))).toBe(
			false,
		);

		for (const variableName of [
			'--music-player-prompt-bg',
			'--music-player-prompt-color',
			'--music-player-prompt-border',
			'--music-player-button-bg',
			'--music-player-button-color',
			'--music-player-button-border',
			'--music-player-ring-color',
		]) {
			expect(musicBase).toContain(variableName);
		}
	});

	it('personalized-access index keeps base while bundles load canonical variants', () => {
		const dir = 'src/styles/themes/sections/personalized-access';
		const forwarded = getForwardedPartials(dir);
		const existing = getExistingPartials(dir);
		const bundleImports = getPresetBundleImports('personalized-access');
		const structuralResolverPartials = ['editorial-pass', 'formal-pass'];

		expect(forwarded).toContain('base');

		// Every forwarded partial must have a matching file
		for (const name of forwarded) {
			expect(fs.existsSync(path.join(projectRoot, dir, `_${name}.scss`))).toBe(true);
		}

		// Every existing partial must be forwarded or loaded directly by a preset bundle.
		for (const name of existing) {
			expect(
				forwarded.includes(name) ||
					bundleImports.includes(name) ||
					structuralResolverPartials.includes(name),
			).toBe(true);
		}

		const resolver = read('src/lib/invitation/section-css-resolver.ts');
		expect(resolver).toContain("'/src/styles/themes/sections/*/_*.scss'");
	});

	it('personalized-access base avoids theme-preset selectors', () => {
		const base = read('src/styles/themes/sections/personalized-access/_base.scss');
		expect(base).not.toMatch(/\.theme-preset--\w/);
	});

	it('access-card__title selector uses ancestor context to beat global hN rules', () => {
		const base = read('src/styles/themes/sections/personalized-access/_base.scss');
		const titleBlock = base.match(/\.access-card\s+&__title\s*\{[\s\S]*?\n\t\}/);
		expect(titleBlock).not.toBeNull();
	});

	it('personalized-access base avoids per-variant attribute selectors', () => {
		const base = read('src/styles/themes/sections/personalized-access/_base.scss');
		expect(base).not.toMatch(/\[data-variant='[a-z]/);
	});

	it('personalized-access base avoids legacy @use imports', () => {
		const base = read('src/styles/themes/sections/personalized-access/_base.scss');
		expect(base).not.toMatch(/@use\s/);
	});

	it('no orphaned personalized-access variant partials', () => {
		const dir = 'src/styles/themes/sections/personalized-access';
		const forwarded = getForwardedPartials(dir);
		const existing = getExistingPartials(dir);
		const bundleImports = getPresetBundleImports('personalized-access');
		const structuralResolverPartials = ['editorial-pass', 'formal-pass'];

		// Every file on disk must be intentionally forwarded or imported by a bundle.
		for (const name of existing) {
			expect(
				forwarded.includes(name) ||
					bundleImports.includes(name) ||
					structuralResolverPartials.includes(name),
			).toBe(true);
		}

		for (const name of bundleImports) {
			expect(existing).toContain(name);
		}
	});

	it('preset files contain --pa-* overrides for all required variables', () => {
		for (const preset of PA_PRESET_NAMES) {
			const presetFile = read(`src/styles/themes/presets/_${preset}.scss`);
			const paVarCount = (presetFile.match(/--pa-[\w-]+:/g) || []).length;
			expect(paVarCount).toBeGreaterThanOrEqual(PA_REQUIRED_VARS.length);
			for (const v of PA_REQUIRED_VARS) {
				expect(presetFile).toContain(v);
			}
		}

		// Prevent luxury-hacienda regression to low-contrast title color
		const luxuryFile = read('src/styles/themes/presets/_luxury-hacienda.scss');
		const titleColorMatch = luxuryFile.match(/--pa-title-color:\s*(rgb\([^)]+\)|[^;]+);/);
		if (titleColorMatch) {
			expect(titleColorMatch[1]).not.toMatch(/219,\s*209,\s*180/);
		}
	});

	it('family section has theme variant infrastructure and base contract variables', () => {
		const sectionIndex = read('src/styles/themes/sections/_index.scss');
		const familyBase = read('src/styles/invitation/_family.scss');

		// Family is now part of the section theming system with a forward and directory
		expect(sectionIndex).toContain("@forward 'family'");
		expect(
			fs.existsSync(path.join(projectRoot, 'src/styles/themes/sections/family/_index.scss')),
		).toBe(true);

		for (const variableName of FAMILY_REQUIRED_VARS) {
			expect(familyBase).toContain(variableName);
		}

		expect(familyBase).not.toMatch(/\[data-variant='[a-z]/);
		for (const retired of FAMILY_RETIRED_SELECTORS_AND_VARS) {
			expect(familyBase).not.toContain(retired);
		}
	});

	it('family panel contract variables are active base variables', () => {
		const familyBase = read('src/styles/invitation/_family.scss');

		expect(familyBase).toContain('border: var(--family-panel-border');
		expect(familyBase).toContain('box-shadow: var(--family-panel-shadow');
	});

	it('no orphaned family variant partials', () => {
		const dir = 'src/styles/themes/sections/family';
		const forwarded = getForwardedPartials(dir);
		const existing = getExistingPartials(dir);
		const bundleImports = getPresetBundleImports('family');
		// Structural-only partials are delivered by section-css-resolver, not
		// theme index forwards or preset bundles.
		const structuralResolverPartials = ['split-groups', 'asymmetric-groups'];

		for (const name of existing) {
			expect(
				forwarded.includes(name) ||
					bundleImports.includes(name) ||
					structuralResolverPartials.includes(name),
			).toBe(true);
		}

		for (const name of bundleImports) {
			expect(existing).toContain(name);
		}

		const resolver = read('src/lib/invitation/section-css-resolver.ts');
		expect(resolver).toContain("'/src/styles/themes/sections/*/_*.scss'");
	});

	it('in-scope sections do not use ThemePreset names as data-variant', () => {
		const themePresets = [
			'angelic-presence',
			'celestial-blue',
			'editorial',
			'editorial-rose',
			'editorial-magazine',
			'enchanted-rose',
			'jewelry-box',
			'jewelry-box-wedding',
			'luxury-hacienda',
			'premiere-floral',
			'sacred-keepsake',
		];
		const dirs = [
			'header',
			'quote',
			'music-player',
			'footer',
			'countdown',
			'family',
			'location',
			'gallery',
			'gifts',
			'rsvp',
			'hero',
		];
		const files = dirs.flatMap((dir) =>
			getFilesRecursively(`src/styles/themes/sections/${dir}`, ['.scss']),
		);
		const joined = files.map(read).join('\n');
		for (const preset of themePresets) {
			expect(joined).not.toContain(`[data-variant='${preset}']`);
		}
	});

	it('hero theme skins keep structural data-variant (not bare theme-preset heroes)', () => {
		const editorial = read('src/styles/themes/sections/hero/_editorial.scss');
		expect(editorial).toContain(
			".theme-preset--editorial .invitation-hero[data-variant='standard']",
		);
		expect(editorial).toContain(
			".theme-preset--premiere-floral .invitation-hero[data-variant='standard']",
		);
		// Romina: Production dual-attr skin → post-decouple structural split-cover.
		expect(editorial).toContain(
			".theme-preset--premiere-floral .invitation-hero[data-variant='split-cover']",
		);
		expect(editorial).not.toMatch(/\.theme-preset--editorial\s+\.invitation-hero\s*[,{]/);
		expect(editorial).not.toContain(
			".theme-preset--editorial .invitation-hero[data-variant='split-cover']",
		);
	});

	it('header and music player runtime emit standard, not theme.preset', () => {
		const slugPage = read('src/pages/[eventType]/[slug].astro');
		const previewPage = read('src/pages/dashboard/invitaciones/[id]/preview.astro');
		const music = read('src/lib/invitation/local-preview-config.ts');
		expect(slugPage).toContain('variant="standard"');
		expect(previewPage).toContain('variant="standard"');
		expect(slugPage).not.toContain('variant={page.viewModel.theme.preset}');
		expect(previewPage).not.toContain('variant={pageCtx.viewModel.theme.preset}');
		expect(music).toContain("variant: 'standard'");
		expect(music).not.toContain('variant: input.themePreset');
	});

	it('celestial thank-you and hero modules consume section surface tokens', () => {
		const thankYou = read('src/styles/themes/sections/thank-you/_celestial-blue.scss');
		const hero = read('src/styles/themes/sections/hero/_celestial-blue.scss');
		const preset = read('src/styles/themes/presets/_celestial-blue.scss');
		const xareni = read('src/styles/invitation-profiles/xareni-iyarit.scss');

		expect(thankYou).toContain('var(--thank-you-section-background)');
		expect(thankYou).toContain('var(--thank-you-section-color');
		expect(thankYou).toContain('var(--thank-you-section-padding)');
		expect(thankYou).toContain('--thank-you-message-color');
		expect(hero).toContain('var(--hero-section-background');
		expect(hero).toContain('var(--hero-section-color');

		expect(preset).toContain('--thank-you-section-background');
		expect(preset).toContain('--thank-you-section-color');
		expect(preset).toContain('--hero-section-background');
		expect(preset).toContain('--hero-section-color');

		// Xareni remaps celestial palette; must not force a dark thank-you surface
		// (pre-ownership `.thank-you` rules were dead and never painted Production).
		expect(xareni).not.toContain('--thank-you-section-background:');
		expect(xareni).not.toContain('--thank-you-message-color:');
		expect(xareni).toContain('--color-deep-blue-graphite: var(--xareni-plum)');
	});

	it('luxury heading chrome does not force thank-you accent color', () => {
		const luxury = read('src/styles/themes/sections/theme-shell/_luxury-hacienda.scss');
		const headingChrome = luxury.slice(
			luxury.indexOf('// Component chrome'),
			luxury.indexOf('.card,'),
		);
		expect(headingChrome).toContain('.event-location &');
		expect(headingChrome).not.toContain('.thank-you-section &');
	});

	it('premiere hero skin zeroes padding only for standard (split-cover keeps editorial inset)', () => {
		const premiereHero = read('src/styles/themes/sections/hero/_premiere-floral.scss');
		expect(premiereHero).toMatch(
			/\.theme-preset--premiere-floral\s+\.invitation-hero\[data-variant='standard'\]\s*\{[^}]*padding:\s*0;/s,
		);
		expect(premiereHero).not.toMatch(
			/\.theme-preset--premiere-floral\s+\.invitation-hero\[data-variant='split-cover'\]\s*\{[^}]*padding:\s*0;/s,
		);
		expect(premiereHero).toContain(
			".theme-preset--premiere-floral .invitation-hero[data-variant='split-cover']",
		);
	});

	it('split-cover does not shadow profile --hero-split-title-* tokens on the section', () => {
		const split = read('src/styles/themes/sections/hero/_split-cover.scss');
		const defaultsBlock = split.slice(
			split.indexOf(".invitation-hero[data-variant='split-cover']"),
			split.indexOf('.invitation-hero__title'),
		);
		expect(defaultsBlock).not.toMatch(/--hero-split-title-font:\s*var\(--font-display\)/);
		expect(split).toContain('var(--hero-split-title-font, var(--font-display))');
	});

	it('romina profile reasserts split-cover title tokens and clears base gradient chrome', () => {
		const romina = read('src/styles/invitation-profiles/romina-rios-chaparro.scss');
		expect(romina).toContain(".invitation-hero[data-variant='split-cover']");
		expect(romina).toContain("@use '@fontsource/parisienne/400.css'");
		expect(romina).toContain("--hero-split-title-font: 'Parisienne', cursive");
		expect(romina).toContain('-webkit-text-fill-color: var(--romina-ivory)');
		expect(romina).toContain('background: none');
	});

	it('alba thank-you restores circular photo-frame geometry', () => {
		const alba = read('src/styles/invitation-profiles/alba-rosa-quinonez.scss');
		const thankYou = alba.slice(alba.indexOf('.thank-you-section {'));
		expect(thankYou).toContain('border-radius: 50%');
		expect(thankYou).toContain('clip-path: circle(');
	});

	it('preset bundles do not reintroduce theme-base imports', () => {
		const bundleDir = 'src/styles/invitation-sections-by-preset';
		const absoluteDir = path.join(projectRoot, bundleDir);
		const files = fs.readdirSync(absoluteDir).filter((f) => f.endsWith('.scss'));
		for (const file of files) {
			const content = read(`${bundleDir}/${file}`);
			expect(content).not.toMatch(/@use\s+['"][^'"]*theme-base/);
		}
	});
});
