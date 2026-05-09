import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const presetsDir = 'src/styles/themes/presets';
const presetsPath = path.join(projectRoot, presetsDir);

function readTextFile(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function parseInvitationImports(content: string): string[] {
	const imports: string[] = [];
	const regex = /^\s*@use\s+['"]([^'"]+)['"]\s*;/gm;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(content)) !== null) {
		imports.push(match[1]);
	}

	return imports;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPresetReference(content: string, preset: string): boolean {
	const escapedPreset = escapeRegExp(preset);

	const patterns = [
		new RegExp(`\\.theme-preset--${escapedPreset}\\b`),
		new RegExp(`\\[data-variant=['"]${escapedPreset}['"]\\]`),
		new RegExp(`@use\\s+['"]${escapedPreset}['"]`),
		new RegExp(`url\\([^)]*${escapedPreset}`),
	];

	return patterns.some((pattern) => pattern.test(content));
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

const invitationContent = readTextFile(`${presetsDir}/_invitation.scss`);
const invitationImports = parseInvitationImports(invitationContent);
const otherPresets = invitationImports.filter((preset) => preset !== 'angelic-presence');
const angelicContent = readTextFile(`${presetsDir}/_angelic-presence.scss`);

describe('Theme preset registry', () => {
	it('invitation barrel imports angelic-presence', () => {
		expect(invitationImports).toContain('angelic-presence');
	});

	it('all invitation imports correspond to existing SCSS files', () => {
		for (const imported of invitationImports) {
			const filePath = path.join(presetsPath, `_${imported}.scss`);
			expect(fs.existsSync(filePath)).toBe(true);
		}
	});

	it('import names match file names exactly for Linux/Vercel compatibility', () => {
		const actualFiles = fs.readdirSync(presetsPath);

		for (const imported of invitationImports) {
			expect(actualFiles).toContain(`_${imported}.scss`);
		}
	});
});

describe('Angelic presence theme isolation', () => {
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
