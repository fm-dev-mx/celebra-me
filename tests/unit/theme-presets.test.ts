import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const presetsDir = 'src/styles/themes/presets';
const presetsPath = path.join(projectRoot, presetsDir);

const interludeContractVariables = [
	'--interlude-bg',
	'--interlude-image-filter',
	'--interlude-overlay-opacity',
	'--interlude-overlay',
] as const;

const familyContractVariables = [
	'--family-bg',
	'--family-panel-bg',
	'--family-panel-border',
	'--family-panel-shadow',
	'--family-accent',
	'--family-text-primary',
	'--family-text-muted',
	'--family-divider',
	'--family-title-font',
	'--family-name-font',
	'--family-media-bg',
	'--family-media-border',
	'--family-media-shadow',
	'--family-media-filter',
] as const;

function expectInterludeContract(content: string): void {
	for (const variableName of interludeContractVariables) {
		expect(content).toContain(variableName);
	}
	expect(content).not.toContain('--interlude-image-scale');
	expect(content).not.toContain('--interlude-overlay-secondary');
	expect(content).not.toContain('src/styles/themes/sections/interlude');
}

function expectFamilyContract(content: string): void {
	for (const variableName of familyContractVariables) {
		expect(content).toContain(variableName);
	}
	expect(content).not.toContain('--family-ledger-display');
	expect(content).not.toContain('--family-container-max-width');
	expect(content).not.toContain('--family-panel-padding');
	expect(content).not.toContain('--family-media-column');
	expect(content).not.toContain('--family-content-column');
	expect(content).not.toContain('--family-connector-size');
	expect(content).not.toContain('src/styles/themes/sections/family');
}

function parseInvitationImports(content: string): string[] {
	const imports: string[] = [];
	const regex = /^\s*@use\s+['"]([^'"]+)['"](?:\s+as\s+\S+)?\s*;/gm;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(content)) !== null) {
		imports.push(match[1]);
	}

	return imports;
}

function hasPresetReference(content: string, preset: string): boolean {
	const escapedPreset = preset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const presetOnlyPattern = new RegExp(`\\b${escapedPreset}\\b`);

	const patterns = [
		new RegExp(`\\.theme-preset--${escapedPreset}\\b`),
		new RegExp(`\\[data-variant=['"]${escapedPreset}['"]\\]`),
		new RegExp(`@use\\s+['"]${escapedPreset}['"]`),
		new RegExp(`url\\([^)]*\\b${escapedPreset}\\b[^)]*\\)`),
	];

	return patterns.some((pattern) => pattern.test(content)) && presetOnlyPattern.test(content);
}

function getTopLevelSelectors(content: string): string[] {
	const withoutImports = content.replace(
		/^\s*@use\s+['"][^'"]+['"](?:\s+as\s+\S+)?\s*;\s*/gm,
		'',
	);
	const withoutComments = withoutImports.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

	const selectors: string[] = [];
	let depth = 0;
	let buffer = '';

	for (const char of withoutComments) {
		if (char === '{') {
			if (depth === 0) {
				const selector = buffer.trim();
				if (selector) selectors.push(selector);
			}
			depth += 1;
			buffer = '';
			continue;
		}

		if (char === '}') {
			depth -= 1;
			buffer = '';
			continue;
		}

		if (depth === 0) {
			buffer += char;
		}
	}

	return selectors;
}

describe('Invitation barrel', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);

	it('imports all expected theme presets', () => {
		expect(invitationImports).toContain('angelic-presence');
		expect(invitationImports).toContain('sacred-keepsake');
		expect(invitationImports).toContain('enchanted-rose');
		expect(invitationImports).not.toContain('cesar-ramses');
	});

	it('import names match existing SCSS files', () => {
		for (const imported of invitationImports) {
			const filePath = path.join(presetsPath, `_${imported}.scss`);
			expect(fs.existsSync(filePath)).toBe(true);
		}
	});
});

describe('Interlude section contract', () => {
	const interludeContent = fs.readFileSync(
		path.join(projectRoot, 'src/styles/invitation/_interlude.scss'),
		'utf8',
	);

	it('keeps the simplified four-variable visual contract explicit', () => {
		for (const variableName of [
			'--interlude-bg',
			'--interlude-image-filter',
			'--interlude-overlay-opacity',
			'--interlude-overlay',
		]) {
			expect(interludeContent).toContain(variableName);
		}
	});

	it('does not reintroduce retired interlude visual variables', () => {
		expect(interludeContent).not.toContain('--interlude-image-scale');
		expect(interludeContent).not.toContain('--interlude-overlay-secondary');
	});

	it('supports data-height tall variant with a min-height variable', () => {
		expect(interludeContent).toContain("&[data-height='tall']");
		expect(interludeContent).toContain('--interlude-min-height-tall');
	});

	it('defaults scroll-margin-top to the centralized header-offset value', () => {
		expect(interludeContent).toContain(
			'scroll-margin-top: var(--invitation-header-offset, calc(70px + 1.5rem))',
		);
		expect(interludeContent).not.toContain('--interlude-scroll-margin-top');
	});
});

describe('Angelic presence theme isolation', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);
	const otherPresets = invitationImports.filter((preset) => preset !== 'angelic-presence');
	const angelicContent = fs.readFileSync(path.join(presetsDir, '_angelic-presence.scss'), 'utf8');

	it('defines the expected theme root scope', () => {
		expect(angelicContent).toContain('.theme-preset--angelic-presence');
	});

	it('does not define top-level selectors outside its theme scope', () => {
		const topLevelSelectors = getTopLevelSelectors(angelicContent);

		expect(topLevelSelectors).toEqual(['.theme-preset--angelic-presence']);
	});

	it('does not reference other registered presets', () => {
		for (const preset of otherPresets) {
			expect(hasPresetReference(angelicContent, preset)).toBe(false);
		}
	});

	it('does not contain !important', () => {
		expect(angelicContent).not.toContain('!important');
	});

	it('does not reference event-specific content', () => {
		expect(angelicContent).not.toMatch(/\bana-sofia\b/i);
		expect(angelicContent).not.toMatch(/\bquince\b/i);
		expect(angelicContent).not.toMatch(/\bXV\b/);
		expect(angelicContent).not.toMatch(/events[/-]/i);
	});
});

describe('Angelic presence section coverage', () => {
	// Sections intentionally absent (use base section styles):
	//   - header, music (uses base music player contract and preset variables)
	//   - interlude (uses base interlude contract and preset variables)
	//   - location (uses base location contract and preset --location-* variables)
	//   - family (uses base family contract and preset --family-* variables)
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_angelic-presence.scss',
		'src/styles/themes/sections/gallery/_angelic-presence.scss',
		'src/styles/themes/sections/countdown/_angelic-presence.scss',
		'src/styles/themes/sections/itinerary/_angelic-presence.scss',
		'src/styles/themes/sections/rsvp/_angelic-presence.scss',
		'src/styles/themes/sections/thank-you/_angelic-presence.scss',
		'src/styles/themes/sections/footer/_angelic-presence.scss',
	];

	it('styles every visible demo section with angelic-presence selectors', () => {
		for (const relativePath of sectionThemeFiles) {
			const filePath = path.join(projectRoot, relativePath);
			expect(fs.readFileSync(filePath, 'utf8')).toContain("data-variant='angelic-presence'");
		}
	});

	it('styles location through the base location contract', () => {
		const angelicContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_angelic-presence.scss'),
			'utf8',
		);

		expect(angelicContent).toContain('--location-bg');
		expect(angelicContent).toContain('--location-card-bg');
		expect(angelicContent).toContain('--location-image-aspect-ratio');
		expect(angelicContent).toContain('--location-nav-bg');
		expect(angelicContent).toContain('--location-indications-grid-template');
	});

	it('styles interludes through the base interlude contract', () => {
		const angelicContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_angelic-presence.scss'),
			'utf8',
		);

		expectInterludeContract(angelicContent);
	});

	it('styles family through the base family contract', () => {
		const angelicContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_angelic-presence.scss'),
			'utf8',
		);

		expectFamilyContract(angelicContent);
	});

	it('does not duplicate the base scroll-margin default', () => {
		const angelicContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_angelic-presence.scss'),
			'utf8',
		);

		expect(angelicContent).not.toContain('--interlude-scroll-margin-top');
	});
});

describe('Celestial blue theme isolation', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);
	const otherPresets = invitationImports.filter((preset) => preset !== 'celestial-blue');
	const celestialContent = fs.readFileSync(path.join(presetsDir, '_celestial-blue.scss'), 'utf8');

	it('defines the expected theme root scope', () => {
		expect(celestialContent).toContain('.theme-preset--celestial-blue');
	});

	it('does not define top-level selectors outside its theme scope', () => {
		const topLevelSelectors = getTopLevelSelectors(celestialContent);

		expect(topLevelSelectors).toEqual(['.theme-preset--celestial-blue']);
	});

	it('does not reference other registered presets', () => {
		for (const preset of otherPresets) {
			expect(hasPresetReference(celestialContent, preset)).toBe(false);
		}
	});

	it('does not contain !important', () => {
		expect(celestialContent).not.toContain('!important');
	});
});

describe('Celestial blue section coverage', () => {
	// Sections intentionally absent (use base section styles):
	//   - location (uses base location contract and preset --location-* variables)
	//   - family (uses base family contract and preset --family-* variables)
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_celestial-blue.scss',
		'src/styles/themes/sections/gallery/_celestial-blue.scss',
		'src/styles/themes/sections/countdown/_celestial-blue.scss',
		'src/styles/themes/sections/itinerary/_celestial-blue.scss',
		'src/styles/themes/sections/rsvp/_celestial-blue.scss',
		'src/styles/themes/sections/thank-you/_celestial-blue.scss',
	];

	it('styles every visible section with celestial-blue selectors', () => {
		for (const relativePath of sectionThemeFiles) {
			const filePath = path.join(projectRoot, relativePath);
			expect(fs.readFileSync(filePath, 'utf8')).toContain("data-variant='celestial-blue'");
		}
	});

	it('styles location through the base location contract', () => {
		const celestialContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_celestial-blue.scss'),
			'utf8',
		);

		expect(celestialContent).toContain('--location-bg');
		expect(celestialContent).toContain('--location-card-bg');
		expect(celestialContent).toContain('--location-image-aspect-ratio');
		expect(celestialContent).toContain('--location-nav-bg');
		expect(celestialContent).toContain('--location-indications-grid-template');
	});

	it('styles interludes through the base interlude contract', () => {
		const celestialContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_celestial-blue.scss'),
			'utf8',
		);

		expectInterludeContract(celestialContent);
	});

	it('styles family through the base family contract', () => {
		const celestialContent = fs.readFileSync(
			path.join(projectRoot, 'src/styles/themes/presets/_celestial-blue.scss'),
			'utf8',
		);

		expectFamilyContract(celestialContent);
	});
});

describe('Enchanted rose theme isolation', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);
	const otherPresets = invitationImports.filter((preset) => preset !== 'enchanted-rose');
	const enchantedContent = fs.readFileSync(path.join(presetsDir, '_enchanted-rose.scss'), 'utf8');

	it('defines the expected theme root scope', () => {
		expect(enchantedContent).toContain('.theme-preset--enchanted-rose');
	});

	it('does not define top-level selectors outside its theme scope', () => {
		const topLevelSelectors = getTopLevelSelectors(enchantedContent);

		expect(topLevelSelectors).toEqual(['.theme-preset--enchanted-rose']);
	});

	it('does not reference other registered presets', () => {
		for (const preset of otherPresets) {
			expect(hasPresetReference(enchantedContent, preset)).toBe(false);
		}
	});

	it('does not contain !important', () => {
		expect(enchantedContent).not.toContain('!important');
	});
});

describe('Enchanted rose section coverage', () => {
	// Sections intentionally absent (use base section styles and preset variables):
	//   - location, family, gifts, quote, interlude, music, personalized-access, footer
	//   - header, countdown, itinerary until concrete selector work is needed
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_enchanted-rose.scss',
		'src/styles/themes/sections/gallery/_enchanted-rose.scss',
		'src/styles/themes/sections/rsvp/_enchanted-rose.scss',
		'src/styles/themes/sections/thank-you/_enchanted-rose.scss',
	];
	const enchantedContent = fs.readFileSync(
		path.join(projectRoot, 'src/styles/themes/presets/_enchanted-rose.scss'),
		'utf8',
	);

	it('styles every intentionally created section with enchanted-rose selectors', () => {
		for (const relativePath of sectionThemeFiles) {
			const filePath = path.join(projectRoot, relativePath);
			expect(fs.readFileSync(filePath, 'utf8')).toContain("data-variant='enchanted-rose'");
		}
	});

	it('styles location through the base location contract', () => {
		expect(enchantedContent).toContain('--location-bg');
		expect(enchantedContent).toContain('--location-card-bg');
		expect(enchantedContent).toContain('--location-image-aspect-ratio');
		expect(enchantedContent).toContain('--location-nav-bg');
		expect(enchantedContent).toContain('--location-indications-grid-template');
	});

	it('styles interludes through the base interlude contract', () => {
		expectInterludeContract(enchantedContent);
	});

	it('styles family through the base family contract', () => {
		expectFamilyContract(enchantedContent);
	});
});

describe('Sacred keepsake theme isolation', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);
	const otherPresets = invitationImports.filter((preset) => preset !== 'sacred-keepsake');
	const sacredContent = fs.readFileSync(path.join(presetsDir, '_sacred-keepsake.scss'), 'utf8');

	it('defines the expected standalone theme root scope', () => {
		expect(sacredContent).toContain('.theme-preset--sacred-keepsake');
	});

	it('does not define top-level selectors outside its theme scope', () => {
		const topLevelSelectors = getTopLevelSelectors(sacredContent);

		expect(topLevelSelectors).toEqual(['.theme-preset--sacred-keepsake']);
	});

	it('does not reference event identity, angelic-presence, or other registered presets', () => {
		for (const preset of otherPresets) {
			expect(hasPresetReference(sacredContent, preset)).toBe(false);
		}
		expect(sacredContent).not.toContain('cesar-ramses');
		expect(sacredContent).not.toContain('Cesar Ramses');
		expect(sacredContent).not.toContain('César Ramses');
		expect(sacredContent).not.toContain('angelic-presence');
		expect(sacredContent).not.toContain('color-angelic');
		expect(sacredContent).not.toContain('angelic-');
	});

	it('does not contain !important', () => {
		expect(sacredContent).not.toContain('!important');
	});
});

describe('Sacred keepsake section coverage', () => {
	// Sections intentionally absent (use base section styles per architecture docs):
	//   - quote (documented base-style fallback)
	//   - gifts (documented base-style fallback)
	//   - music (uses base music player contract and preset variables)
	//   - interlude (uses base interlude contract and preset variables)
	//   - footer (uses base footer styles)
	//   - location (uses base location contract and preset --location-* variables)
	//   - family (uses base family contract and preset --family-* variables)
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_sacred-keepsake.scss',
		'src/styles/themes/sections/countdown/_sacred-keepsake.scss',
		'src/styles/themes/sections/gallery/_sacred-keepsake.scss',
		'src/styles/themes/sections/itinerary/_sacred-keepsake.scss',
		'src/styles/themes/sections/rsvp/_sacred-keepsake.scss',
		'src/styles/themes/sections/thank-you/_sacred-keepsake.scss',
		'src/styles/themes/sections/header/_sacred-keepsake.scss',
	];
	const sacredContent = fs.readFileSync(
		path.join(projectRoot, 'src/styles/themes/presets/_sacred-keepsake.scss'),
		'utf8',
	);

	it('styles every migrated visible section with sacred-keepsake selectors', () => {
		for (const relativePath of sectionThemeFiles) {
			const filePath = path.join(projectRoot, relativePath);
			const content = fs.readFileSync(filePath, 'utf8');

			expect(content).toContain("data-variant='sacred-keepsake'");
			expect(content).not.toContain('cesar-ramses');
			expect(content).not.toContain('Cesar Ramses');
			expect(content).not.toContain('César Ramses');
			expect(content).not.toContain('angelic-presence');
			expect(content).not.toContain('color-angelic');
			expect(content).not.toContain('angelic-');
		}
	});

	it('styles location through the base location contract', () => {
		expect(sacredContent).toContain('--location-card-bg');
		expect(sacredContent).toContain('--location-image-aspect-ratio');
		expect(sacredContent).toContain('--location-nav-bg');
		expect(sacredContent).toContain('--location-indications-grid-template');
	});

	it('styles music through the base music player contract', () => {
		for (const variableName of [
			'--music-player-prompt-bg',
			'--music-player-prompt-color',
			'--music-player-prompt-border',
			'--music-player-button-bg',
			'--music-player-button-color',
			'--music-player-button-border',
			'--music-player-ring-color',
		]) {
			expect(sacredContent).toContain(variableName);
		}
		expect(sacredContent).not.toContain('src/styles/themes/sections/music');
	});

	it('styles interludes through the base interlude contract', () => {
		expectInterludeContract(sacredContent);
	});

	it('styles family through the base family contract', () => {
		expectFamilyContract(sacredContent);
	});
});

describe('Family section contract', () => {
	const invitationContent = fs.readFileSync(path.join(presetsDir, '_invitation.scss'), 'utf8');
	const invitationImports = parseInvitationImports(invitationContent);

	it('styles family through preset variables for all active presets', () => {
		for (const preset of invitationImports) {
			const presetContent = fs.readFileSync(path.join(presetsDir, `_${preset}.scss`), 'utf8');
			expectFamilyContract(presetContent);
		}
	});
});

describe('Luxury hacienda interlude contract', () => {
	const luxuryContent = fs.readFileSync(
		path.join(projectRoot, 'src/styles/themes/presets/_luxury-hacienda.scss'),
		'utf8',
	);

	it('uses the standard --interlude-image-filter contract variable', () => {
		expect(luxuryContent).toContain('--interlude-image-filter');
	});

	it('does not use the disconnected legacy filter variable', () => {
		expect(luxuryContent).not.toContain('--theme-image-filter-interlude');
	});
});
