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

// Extract variants from centralized theme contract
function extractContractVariants() {
	const contractPath = path.join(__dirname, '..', 'src', 'lib', 'theme', 'theme-contract.ts');
	const content = fs.readFileSync(contractPath, 'utf8');

	const variants = {
		countdown: new Set(),
		location: new Set(),
		family: new Set(),
		gifts: new Set(),
		gallery: new Set(),
		thankYou: new Set(),
		itinerary: new Set(),
	};

	function parseArrayConst(constName) {
		const regex = new RegExp(
			`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`,
		);
		const match = content.match(regex);
		if (!match) return [];

		return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
	}

	const themeVariants = parseArrayConst('THEME_PRESETS');
	for (const key of Object.keys(variants)) {
		themeVariants.forEach((v) => variants[key].add(v));
	}

	return variants;
}

// Extract variants from CSS files
function extractCSSVariants(contractVariants) {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');

	const variants = {
		countdown: new Set(),
		location: new Set(),
		family: new Set(),
		gifts: new Set(),
		gallery: new Set(),
		thankYou: new Set(),
		itinerary: new Set(),
	};

	const sectionDirectories = {
		countdown: 'countdown',
		location: 'location',
		family: 'family',
		gifts: 'gifts',
		gallery: 'gallery',
		thankYou: 'thank-you',
		itinerary: 'itinerary',
	};

	function collectScssFiles(dir) {
		if (!fs.existsSync(dir)) return [];

		return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const entryPath = path.join(dir, entry.name);
			if (entry.isDirectory()) return collectScssFiles(entryPath);
			return entry.name.endsWith('.scss') ? [entryPath] : [];
		});
	}

	for (const [section, directory] of Object.entries(sectionDirectories)) {
		const files = collectScssFiles(path.join(themesDir, directory));

		for (const filePath of files) {
			const content = fs.readFileSync(filePath, 'utf8');

			// Find [data-variant='value'] patterns
			const variantRegex = /\[data-variant=['"]([^'"]+)['"]\]/g;
			let match;
			while ((match = variantRegex.exec(content)) !== null) {
				variants[section].add(match[1]);
			}

			const variantPrefixRegex = /\[data-variant\^=['"]([^'"]+)['"]\]/g;
			while ((match = variantPrefixRegex.exec(content)) !== null) {
				const prefix = match[1];
				for (const variant of contractVariants[section]) {
					if (variant.startsWith(prefix)) {
						variants[section].add(variant);
					}
				}
			}
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
	const cssVariants = extractCSSVariants(contractVariants);

	console.log('Phase 3: Comparing variants...');

	// Compare each section
	const sections = [
		'countdown',
		'location',
		'family',
		'gifts',
		'gallery',
		'thankYou',
		'itinerary',
	];

	const EXPECTED_FALLBACKS = [];

	for (const section of sections) {
		const contractSet = contractVariants[section];
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(
			`  Contract variants: ${Array.from(contractSet).sort().join(', ') || '(none)'}`,
		);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

		// If a section has zero variant CSS files, all contract variants are base-style fallbacks.
		// If it has some, missing variants are genuine warnings.
		const hasAnyCSSVariants = cssSet.size > 0;

		for (const variant of contractSet) {
			if (!cssSet.has(variant)) {
				if (hasAnyCSSVariants) {
					WARNINGS.push(`${section}: Contract variant '${variant}' not found in CSS`);
				} else {
					EXPECTED_FALLBACKS.push(
						`${section}: Contract variant '${variant}' intentionally uses base section styles`,
					);
				}
			}
		}

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

// Run main function
try {
	main();
} catch (error) {
	console.error('❌ Validation failed:', error);
	process.exit(1);
}
