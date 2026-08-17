#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ERRORS = [];
const WARNINGS = [];

// Canonical structural contracts and their isolated SCSS ownership. Variants listed in
// `baseOnly` intentionally use the shared renderer/base stylesheet and need no dedicated partial.
const SECTION_CONTRACTS = {
	hero: {
		directory: 'hero',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'HERO_VARIANTS',
		baseOnly: ['standard'],
	},
	family: {
		directory: 'family',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'FAMILY_VARIANTS',
		baseOnly: ['standard'],
	},
	location: {
		directory: 'location',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'LOCATION_VARIANTS',
		baseOnly: ['standard'],
	},
	gallery: {
		directory: 'gallery',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'GALLERY_VARIANTS',
		baseOnly: ['uniform-grid', 'single-keepsake'],
	},
	itinerary: {
		directory: 'itinerary',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'ITINERARY_VARIANTS',
		baseOnly: ['standard'],
	},
	gifts: {
		directory: 'gifts',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'GIFTS_VARIANTS',
		baseOnly: ['standard'],
	},
	rsvp: {
		directory: 'rsvp',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'RSVP_VARIANTS',
		baseOnly: ['standard'],
	},
	personalizedAccess: {
		directory: 'personalized-access',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'PERSONALIZED_ACCESS_VARIANTS',
		baseOnly: ['standard', 'ornamented'],
	},
	thankYou: {
		directory: 'thank-you',
		source: 'src/lib/invitation/section-variants.ts',
		constName: 'THANK_YOU_VARIANTS',
		baseOnly: ['standard'],
	},
};

function extractContractVariants() {
	function parseArrayConst(source, constName) {
		const content = fs.readFileSync(path.join(__dirname, '..', source), 'utf8');
		const regex = new RegExp(
			`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`,
		);
		const match = content.match(regex);
		if (!match) return [];

		return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
	}

	const variants = {};
	for (const [key, contract] of Object.entries(SECTION_CONTRACTS)) {
		variants[key] = new Set(parseArrayConst(contract.source, contract.constName));
	}
	return variants;
}

function collectScssFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return collectScssFiles(entryPath);
		return entry.name.endsWith('.scss') ? [entryPath] : [];
	});
}

const THEME_PRESET_SKINS = new Set([
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
	'single',
]);

function extractCSSVariants() {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');
	const variants = {};

	for (const [section, contract] of Object.entries(SECTION_CONTRACTS)) {
		variants[section] = new Set();
		const files = collectScssFiles(path.join(themesDir, contract.directory));

		for (const filePath of files) {
			const content = fs.readFileSync(filePath, 'utf8');

			const variantRegex = /\[data-variant=['"]([^'"]+)['"]\]/g;
			let match;
			while ((match = variantRegex.exec(content)) !== null) {
				const v = match[1];
				if (!THEME_PRESET_SKINS.has(v)) {
					variants[section].add(v);
				}
			}
		}
	}
	return variants;
}

function checkPresetIsolation() {
	const presetsDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'presets');
	const files = fs.readdirSync(presetsDir);
	const violations = [];

	for (const file of files) {
		if (!file.endsWith('.scss') || file === '_all.scss' || file === '_invitation.scss')
			continue;

		const filePath = path.join(presetsDir, file);
		const content = fs.readFileSync(filePath, 'utf8');
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line || line.startsWith('//') || line.startsWith('/*')) continue;
			if (line.startsWith('#{')) continue;
			if (/^[.#a-zA-Z][^{]*\{\s*$/.test(line) && !line.includes('--')) {
				violations.push({
					file,
					line: i + 1,
					content: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
				});
			}
		}
	}
	return violations;
}

function main() {
	console.log('🔍 Starting schema validation...');
	console.log('================================');

	const contractVariants = extractContractVariants();
	const cssVariants = extractCSSVariants();
	const EXPECTED_FALLBACKS = [];

	for (const [section, contract] of Object.entries(SECTION_CONTRACTS)) {
		const contractSet = contractVariants[section];
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(
			`  Contract variants: ${Array.from(contractSet).sort().join(', ') || '(none)'}`,
		);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

		for (const variant of contractSet) {
			if (!cssSet.has(variant)) {
				if (contract.baseOnly.includes(variant)) {
					EXPECTED_FALLBACKS.push(
						`${section}: Contract variant '${variant}' intentionally uses base section styles`,
					);
				} else {
					WARNINGS.push(`${section}: Contract variant '${variant}' not found in CSS`);
				}
			}
		}

		for (const variant of cssSet) {
			if (!contractSet.has(variant)) {
				ERRORS.push(`${section}: CSS variant '${variant}' not found in ThemeContract`);
			}
		}
	}

	const presetViolations = checkPresetIsolation();
	for (const violation of presetViolations) {
		ERRORS.push(
			`Preset ${violation.file}:${violation.line} - CSS rule found: ${violation.content}`,
		);
	}

	console.log('\n================================');
	console.log('Validation complete!');
	console.log(`Errors: ${ERRORS.length}`);
	console.log(`Warnings: ${WARNINGS.length}`);
	console.log(`Expected base-style fallbacks: ${EXPECTED_FALLBACKS.length}`);

	if (ERRORS.length > 0) {
		console.log('\n❌ ERRORS (must fix):');
		ERRORS.forEach((error) => console.log(`  - ${error}`));
	}
	if (WARNINGS.length > 0) {
		console.log('\n⚠️  WARNINGS (should fix):');
		WARNINGS.forEach((warning) => console.log(`  - ${warning}`));
	}
	if (EXPECTED_FALLBACKS.length > 0) {
		console.log('\nℹ️  Expected base-style fallbacks:');
		EXPECTED_FALLBACKS.forEach((fallback) => console.log(`  - ${fallback}`));
	}
	if (ERRORS.length === 0 && WARNINGS.length === 0) {
		console.log('\n✅ All checks passed! Schema is synchronized.');
	}
}

try {
	main();
} catch (error) {
	console.error('❌ Validation failed:', error);
	process.exit(1);
}
