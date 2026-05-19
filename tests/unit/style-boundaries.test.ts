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
		const footerTheme = read('src/styles/themes/sections/_footer-theme.scss');
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
		const rsvpTheme = read('src/styles/themes/sections/_rsvp-theme.scss');

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
});
