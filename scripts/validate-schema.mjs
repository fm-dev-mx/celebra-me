#!/usr/bin/env node

/**
 * validate-schema.js - Basic schema validation between Zod and CSS
 *
 * This script checks for:
 * 1. Zod enum variants that don't have corresponding CSS selectors
 * 2. CSS selectors that don't have corresponding Zod enum variants
 * 3. Basic schema structure consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting schema validation...');
console.log('================================');

const ERRORS = [];
const WARNINGS = [];
const IMPLICIT_BASE_VARIANTS = {
	family: new Set(['standard']),
	gifts: new Set(['standard']),
	gallery: new Set(['standard']),
	thankYou: new Set(['standard']),
};

// Extract variants from centralized theme contract
function extractContractVariants() {
	const contractPath = path.join(__dirname, '..', 'src', 'lib', 'theme', 'theme-contract.ts');
	const content = fs.readFileSync(contractPath, 'utf8');

	const variants = {
		quote: new Set(),
		countdown: new Set(),
		location: new Set(),
		family: new Set(),
		gifts: new Set(),
		gallery: new Set(),
		thankYou: new Set(),
	};

	function parseArrayConst(constName) {
		const regex = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`);
		const match = content.match(regex);
		if (!match) return [];
		return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
	}

	const quote = parseArrayConst('QUOTE_VARIANTS');
	const countdown = parseArrayConst('COUNTDOWN_VARIANTS');
	const location = parseArrayConst('LOCATION_VARIANTS');
	const shared = parseArrayConst('SHARED_SECTION_VARIANTS');

	quote.forEach((variant) => variants.quote.add(variant));
	countdown.forEach((variant) => variants.countdown.add(variant));
	location.forEach((variant) => variants.location.add(variant));
	shared.forEach((variant) => variants.family.add(variant));
	shared.forEach((variant) => variants.gifts.add(variant));
	shared.forEach((variant) => variants.gallery.add(variant));
	shared.forEach((variant) => variants.thankYou.add(variant));

	return variants;
}

// Extract variants from CSS files
function extractCSSVariants() {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');
	const files = fs.readdirSync(themesDir);

	const variants = {
		quote: new Set(),
		countdown: new Set(),
		location: new Set(),
		family: new Set(),
		gifts: new Set(),
		gallery: new Set(),
		thankYou: new Set(),
	};

	// Map CSS files to sections
	const fileToSection = {
		'_quote-theme.scss': 'quote',
		'_countdown-theme.scss': 'countdown',
		'_location-theme.scss': 'location',
		'_family-theme.scss': 'family',
		'_gifts-theme.scss': 'gifts',
		'_gallery-theme.scss': 'gallery',
		'_thank-you-theme.scss': 'thankYou',
	};

	for (const file of files) {
		const section = fileToSection[file];
		if (!section) continue;

		const filePath = path.join(themesDir, file);
		const content = fs.readFileSync(filePath, 'utf8');

		// Find [data-variant='value'] patterns
		const variantRegex = /\[data-variant=['"]([^'"]+)['"]\]/g;
		let match;
		while ((match = variantRegex.exec(content)) !== null) {
			variants[section].add(match[1]);
		}
	}

	return variants;
}

// Check preset isolation (no direct CSS in preset files)
function checkPresetIsolation() {
	console.log('\n📋 Checking preset isolation...');

	const presetsDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'presets');
	const files = fs.readdirSync(presetsDir);

	const violations = [];

	for (const file of files) {
		if (!file.endsWith('.scss') || file === '_all.scss' || file === '_invitation.scss')
			continue;

		const filePath = path.join(presetsDir, file);
		const content = fs.readFileSync(filePath, 'utf8');

		// Check for CSS rules (selectors that start with . or #, or are element selectors)
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Skip comments and empty lines
			if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

			// Check for CSS rules (not variable declarations)
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

// Main validation
function main() {
	console.log('Phase 1: Extracting ThemeContract variants...');
	const contractVariants = extractContractVariants();

	console.log('Phase 2: Extracting CSS variants...');
	const cssVariants = extractCSSVariants();

	console.log('Phase 3: Comparing variants...');

	// Compare each section
	const sections = ['quote', 'countdown', 'location', 'family', 'gifts', 'gallery', 'thankYou'];

	for (const section of sections) {
		const contractSet = contractVariants[section];
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(
			`  Contract variants: ${Array.from(contractSet).sort().join(', ') || '(none)'}`,
		);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

		// Check for contract variants missing in CSS
		for (const variant of contractSet) {
			if (IMPLICIT_BASE_VARIANTS[section]?.has(variant)) {
				continue;
			}
			if (!cssSet.has(variant)) {
				WARNINGS.push(`${section}: Contract variant '${variant}' not found in CSS`);
			}
		}

		// Check for CSS variants missing in contract
		for (const variant of cssSet) {
			if (!contractSet.has(variant)) {
				ERRORS.push(`${section}: CSS variant '${variant}' not found in ThemeContract`);
			}
		}
	}

	console.log('Phase 4: Checking preset isolation...');
	const presetViolations = checkPresetIsolation();

	if (presetViolations.length > 0) {
		console.log('  ❌ Found preset isolation violations:');
		for (const violation of presetViolations) {
			ERRORS.push(
				`Preset ${violation.file}:${violation.line} - CSS rule found: ${violation.content}`,
			);
		}
	} else {
		console.log('  ✅ All preset files follow isolation law');
	}

	// Report results
	console.log('\n================================');
	console.log('Validation complete!');
	console.log(`Errors: ${ERRORS.length}`);
	console.log(`Warnings: ${WARNINGS.length}`);

	if (ERRORS.length > 0) {
		console.log('\n❌ ERRORS (must fix):');
		ERRORS.forEach((error) => console.log(`  - ${error}`));
	}

	if (WARNINGS.length > 0) {
		console.log('\n⚠️  WARNINGS (should fix):');
		WARNINGS.forEach((warning) => console.log(`  - ${warning}`));
	}

	if (ERRORS.length === 0 && WARNINGS.length === 0) {
		console.log('\n✅ All checks passed! Schema is synchronized.');
	}

	// Exit with error code if there are critical errors
	process.exit(ERRORS.length > 0 ? 1 : 0);
}

// Run main function
main().catch((error) => {
	console.error('❌ Validation failed:', error);
	process.exit(1);
});
