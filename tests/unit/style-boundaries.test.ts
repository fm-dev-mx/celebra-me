import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
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

// Family and Personalized Access share the same preset list
const FAMILY_PRESET_NAMES = PA_PRESET_NAMES;

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
		expect(footerTheme).toContain("[data-variant='editorial']");
		expect(footerTheme).toContain("[data-variant='premiere-floral']");

		for (const file of baseSectionFiles) {
			expect(read(file)).not.toContain('premiere-floral');
		}
	});

	it('rsvp theme ownership stays out of the base invitation stylesheet', () => {
		const rsvpBase = read('src/styles/invitation/_rsvp.scss');
		const rsvpTheme = getFilesRecursively('src/styles/themes/sections/rsvp', ['.scss'])
			.map(read)
			.join('\n');

		expect(rsvpBase).not.toContain("[data-variant='premiere-floral']");
		expect(rsvpBase).not.toContain("[data-variant='editorial']");
		expect(rsvpTheme).toContain("[data-variant='premiere-floral']");
		expect(rsvpTheme).toContain("[data-variant='editorial']");
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

	it('personalized-access index only forwards base', () => {
		const index = read('src/styles/themes/sections/personalized-access/_index.scss');
		expect(index).toContain("@forward 'base'");
		expect(index).not.toMatch(/@forward\s+'[^b]/);
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

	it('no legacy personalized-access variant partials remain', () => {
		for (const name of PA_PRESET_NAMES) {
			const filePath = path.join(
				projectRoot,
				`src/styles/themes/sections/personalized-access/_${name}.scss`,
			);
			expect(fs.existsSync(filePath)).toBe(false);
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

	it('no legacy family variant partials remain', () => {
		for (const name of FAMILY_PRESET_NAMES) {
			const filePath = path.join(
				projectRoot,
				`src/styles/themes/sections/family/_${name}.scss`,
			);
			expect(fs.existsSync(filePath)).toBe(false);
		}
	});
});
