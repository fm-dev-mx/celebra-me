#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ERRORS = [];
const WARNINGS = [];

function extractCanonicalContracts() {
	const contracts = {};
	const registrySource = fs.readFileSync(
		path.join(__dirname, '..', 'src/lib/invitation/section-variants.ts'),
		'utf8',
	);
	const entryPattern =
		/section:\s*'([^']+)'\s*,\s*variant:\s*'([^']+)'[\s\S]*?cssOwner:\s*'([^']+)'/g;
	for (const match of registrySource.matchAll(entryPattern)) {
		const [, section, variant, cssOwner] = match;
		contracts[section] ??= {
			directory:
				section === 'personalizedAccess'
					? 'personalized-access'
					: section === 'thankYou'
						? 'thank-you'
						: section,
			variants: new Set(),
			cssOwners: new Map(),
		};
		contracts[section].variants.add(variant);
		contracts[section].cssOwners.set(variant, cssOwner);
	}
	return contracts;
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

/** In-scope dirs scanned for forbidden theme-as-data-variant beyond the canonical registry. */
const EXTRA_IN_SCOPE_VARIANT_DIRS = ['header', 'quote', 'music-player', 'footer'];

function extractCSSVariants(contracts) {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');
	const variants = {};

	for (const [section, contract] of Object.entries(contracts)) {
		variants[section] = new Set();
		const files = collectScssFiles(path.join(themesDir, contract.directory));

		for (const filePath of files) {
			const content = fs.readFileSync(filePath, 'utf8');
			const relative = path.relative(themesDir, filePath).replace(/\\/g, '/');

			const variantRegex = /\[data-variant=['"]([^'"]+)['"]\]/g;
			let match;
			while ((match = variantRegex.exec(content)) !== null) {
				const v = match[1];
				if (THEME_PRESET_SKINS.has(v)) {
					ERRORS.push(
						`${section}: CSS uses theme preset as data-variant '${v}' in ${relative}`,
					);
					continue;
				}
				variants[section].add(v);
			}
		}
	}
	return variants;
}

function checkExtraInScopeThemeAsVariant() {
	const themesDir = path.join(__dirname, '..', 'src', 'styles', 'themes', 'sections');
	for (const dir of EXTRA_IN_SCOPE_VARIANT_DIRS) {
		const files = collectScssFiles(path.join(themesDir, dir));
		for (const filePath of files) {
			const content = fs.readFileSync(filePath, 'utf8');
			const relative = path.relative(themesDir, filePath).replace(/\\/g, '/');
			const variantRegex = /\[data-variant=['"]([^'"]+)['"]\]/g;
			let match;
			while ((match = variantRegex.exec(content)) !== null) {
				const v = match[1];
				if (THEME_PRESET_SKINS.has(v)) {
					ERRORS.push(
						`${dir}: CSS uses theme preset as data-variant '${v}' in ${relative}`,
					);
				}
			}
		}
	}
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

	const contracts = extractCanonicalContracts();
	const cssVariants = extractCSSVariants(contracts);
	checkExtraInScopeThemeAsVariant();
	const EXPECTED_FALLBACKS = [];

	for (const [section, contract] of Object.entries(contracts)) {
		const contractSet = contract.variants;
		const cssSet = cssVariants[section];

		console.log(`\n${section.toUpperCase()}:`);
		console.log(
			`  Contract variants: ${Array.from(contractSet).sort().join(', ') || '(none)'}`,
		);
		console.log(`  CSS variants: ${Array.from(cssSet).sort().join(', ') || '(none)'}`);

		for (const variant of contractSet) {
			if (!cssSet.has(variant)) {
				const cssOwner = contract.cssOwners.get(variant);
				if (cssOwner === 'no-additional-css') {
					EXPECTED_FALLBACKS.push(
						`${section}: Contract variant '${variant}' explicitly declares no additional CSS`,
					);
				} else if (cssOwner?.startsWith('theme-bundle:')) {
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
