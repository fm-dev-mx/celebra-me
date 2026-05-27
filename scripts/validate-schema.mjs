#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ERRORS = [];
const WARNINGS = [];

// Single source of truth: map section key → SCSS directory under themes/sections/
const SECTION_DIRECTORIES = {
	countdown: 'countdown',
	location: 'location',
	family: 'family',
	gifts: 'gifts',
	gallery: 'gallery',
	thankYou: 'thank-you',
	itinerary: 'itinerary',
};

function extractContractVariants() {
	const contractPath = path.join(__dirname, '..', 'src', 'lib', 'theme', 'theme-contract.ts');
	const content = fs.readFileSync(contractPath, 'utf8');

	function parseArrayConst(constName) {
		const regex = new RegExp(
			`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`,
		);
		const match = content.match(regex);
		if (!match) return [];

		return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
	}

	const themeVariants = parseArrayConst('THEME_PRESETS');
	const variants = {};
	for (const key of Object.keys(SECTION_DIRECTORIES)) {
		variants[key] = new Set(themeVariants);
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

function extractCSSVariants(contractVariants) {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');
	const variants = {};

	for (const section of Object.keys(SECTION_DIRECTORIES)) {
		variants[section] = new Set();
		const files = collectScssFiles(path.join(themesDir, SECTION_DIRECTORIES[section]));

		for (const filePath of files) {
			const content = fs.readFileSync(filePath, 'utf8');

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
	const cssVariants = extractCSSVariants(contractVariants);
	const EXPECTED_FALLBACKS = [];

	for (const section of Object.keys(SECTION_DIRECTORIES)) {
		const contractSet = contractVariants[section];
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(
			`  Contract variants: ${Array.from(contractSet).sort().join(', ') || '(none)'}`,
		);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

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
