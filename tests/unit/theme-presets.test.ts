import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const presetsDir = 'src/styles/themes/presets';
const presetsPath = path.join(projectRoot, presetsDir);

function parseInvitationImports(content: string): string[] {
	const imports: string[] = [];
	const regex = /^\s*@use\s+['"]([^'"]+)['"]\s*;/gm;
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
	const withoutImports = content.replace(/^\s*@use\s+['"][^'"]+['"]\s*;\s*/gm, '');
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
		expect(invitationImports).not.toContain('cesar-ramses');
	});

	it('import names match existing SCSS files', () => {
		for (const imported of invitationImports) {
			const filePath = path.join(presetsPath, `_${imported}.scss`);
			expect(fs.existsSync(filePath)).toBe(true);
		}
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
	//   - header, music
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_angelic-presence.scss',
		'src/styles/themes/sections/quote/_angelic-presence.scss',
		'src/styles/themes/sections/family/_angelic-presence.scss',
		'src/styles/themes/sections/gallery/_angelic-presence.scss',
		'src/styles/themes/sections/countdown/_angelic-presence.scss',
		'src/styles/themes/sections/location/_angelic-presence.scss',
		'src/styles/themes/sections/itinerary/_angelic-presence.scss',
		'src/styles/themes/sections/interlude/_angelic-presence.scss',
		'src/styles/themes/sections/rsvp/_angelic-presence.scss',
		'src/styles/themes/sections/thank-you/_angelic-presence.scss',
		'src/styles/themes/sections/footer/_angelic-presence.scss',
	];

	it('styles every visible baptism demo section with angelic-presence selectors', () => {
		for (const relativePath of sectionThemeFiles) {
			const filePath = path.join(projectRoot, relativePath);
			expect(fs.readFileSync(filePath, 'utf8')).toContain("data-variant='angelic-presence'");
		}
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
	//   - footer (uses base footer styles)
	const sectionThemeFiles = [
		'src/styles/themes/sections/hero/_sacred-keepsake.scss',
		'src/styles/themes/sections/countdown/_sacred-keepsake.scss',
		'src/styles/themes/sections/family/_sacred-keepsake.scss',
		'src/styles/themes/sections/gallery/_sacred-keepsake.scss',
		'src/styles/themes/sections/interlude/_sacred-keepsake.scss',
		'src/styles/themes/sections/itinerary/_sacred-keepsake.scss',
		'src/styles/themes/sections/location/_sacred-keepsake.scss',
		'src/styles/themes/sections/rsvp/_sacred-keepsake.scss',
		'src/styles/themes/sections/thank-you/_sacred-keepsake.scss',
		'src/styles/themes/sections/header/_sacred-keepsake.scss',
		'src/styles/themes/sections/music/_sacred-keepsake.scss',
	];

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
});
