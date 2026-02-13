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

// Extract variants from Zod schema (only variant enums)
function extractZodVariants() {
	const configPath = path.join(__dirname, '..', 'src', 'content', 'config.ts');
	const content = fs.readFileSync(configPath, 'utf8');
	const lines = content.split('\n');

	const variants = {
		quote: new Set(),
		countdown: new Set(),
		location: new Set(),
		family: new Set(),
		gifts: new Set(),
		gallery: new Set(),
		thankYou: new Set(),
	};

	let currentSection = null;
	let inSectionStyles = false;
	let collectingArray = false;
	let arrayContent = '';
	let bracketDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Enter/exit sectionStyles block
		if (trimmed.startsWith('sectionStyles:')) {
			inSectionStyles = true;
			continue;
		}
		if (inSectionStyles && trimmed === '},') {
			// End of sectionStyles object
			inSectionStyles = false;
			currentSection = null;
			continue;
		}

		if (!inSectionStyles) continue;

		// Detect section start
		if (trimmed.startsWith('quote:')) currentSection = 'quote';
		else if (trimmed.startsWith('countdown:')) currentSection = 'countdown';
		else if (trimmed.startsWith('location:')) currentSection = 'location';
		else if (trimmed.startsWith('family:')) currentSection = 'family';
		else if (trimmed.startsWith('gifts:')) currentSection = 'gifts';
		else if (trimmed.startsWith('gallery:')) currentSection = 'gallery';
		else if (trimmed.startsWith('thankYou:')) currentSection = 'thankYou';

		// Detect variant enum start
		if (currentSection && trimmed.includes('variant:') && trimmed.includes('z')) {
			// Look for .enum([ in this line or next lines
			let j = i;
			let enumLine = '';
			while (j < lines.length) {
				enumLine += lines[j];
				if (enumLine.includes('.enum([')) {
					// Found start of enum array
					const startIdx = enumLine.indexOf('[');
					if (startIdx !== -1) {
						arrayContent = enumLine.substring(startIdx);
						bracketDepth = countBrackets(arrayContent);
						collectingArray = true;
						i = j; // advance outer loop
					}
					break;
				}
				j++;
				if (j - i > 5) break; // safety
			}
		}

		if (collectingArray) {
			// Continue collecting lines until brackets balance
			if (i > 0) arrayContent += '\n' + line;
			bracketDepth = countBrackets(arrayContent);
			if (bracketDepth === 0) {
				// Array closed, extract values
				const valueRegex = /'([^']+)'/g;
				let match;
				while ((match = valueRegex.exec(arrayContent)) !== null) {
					variants[currentSection].add(match[1]);
				}
				// Reset state
				collectingArray = false;
				arrayContent = '';
				currentSection = null;
			}
		}
	}

	function countBrackets(str) {
		let depth = 0;
		for (const ch of str) {
			if (ch === '[') depth++;
			else if (ch === ']') depth--;
		}
		return depth;
	}

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
		if (!file.endsWith('.scss') || file === '_all.scss') continue;

		const filePath = path.join(presetsDir, file);
		const content = fs.readFileSync(filePath, 'utf8');

		// Check for CSS rules (selectors that start with . or #, or are element selectors)
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Skip comments and empty lines
			if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

			// Check for CSS rules (not variable declarations)
			if (line.match(/^[.#[a-zA-Z][^{]*\{/) && !line.includes('--')) {
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
	console.log('Phase 1: Extracting Zod schema variants...');
	const zodVariants = extractZodVariants();

	console.log('Phase 2: Extracting CSS variants...');
	const cssVariants = extractCSSVariants();

	console.log('Phase 3: Comparing variants...');

	// Compare each section
	const sections = ['quote', 'countdown', 'location', 'family', 'gifts', 'gallery', 'thankYou'];

	for (const section of sections) {
		const zodSet = zodVariants[section];
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(`  Zod variants: ${Array.from(zodSet).sort().join(', ') || '(none)'}`);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

		// Check for Zod variants missing in CSS
		for (const variant of zodSet) {
			if (!cssSet.has(variant)) {
				WARNINGS.push(`${section}: Zod variant '${variant}' not found in CSS`);
			}
		}

		// Check for CSS variants missing in Zod
		for (const variant of cssSet) {
			if (!zodSet.has(variant)) {
				ERRORS.push(`${section}: CSS variant '${variant}' not found in Zod schema`);
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
