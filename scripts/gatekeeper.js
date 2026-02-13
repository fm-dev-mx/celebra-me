import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const COLORS = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	bold: '\x1b[1m',
};

const FORBIDDEN_FILES = [
	/\.log$/,
	/\.env$/,
	/\.env\.local$/,
	/\.DS_Store$/,
	/dist\//,
	/coverage\//,
	/\.vercel\//,
	/\.astro\//,
];

// --- Helpers ---

function log(message, color = COLORS.reset) {
	console.log(`${color}${message}${COLORS.reset}`);
}

function error(message) {
	console.error(`${COLORS.red}${COLORS.bold}❌ ERROR: ${message}${COLORS.reset}`);
	process.exit(1);
}

function exec(command, options = {}) {
	try {
		return execSync(command, { encoding: 'utf8', stdio: 'pipe', ...options }).trim();
	} catch (e) {
		if (options.ignoreError) return '';
		throw e;
	}
}

function getStagedFiles() {
	try {
		const output = exec('git diff --name-only --cached');
		return output.split('\n').filter((f) => f.trim() !== '');
	} catch (e) {
		error('Failed to get staged files. Are you in a git repository?');
		return [];
	}
}

// --- Checks ---

function checkForbiddenFiles(files) {
	const forbidden = files.filter((file) => FORBIDDEN_FILES.some((regex) => regex.test(file)));
	if (forbidden.length > 0) {
		error(
			`Forbidden files found in staging:\n${forbidden.join('\n')}\n\nPlease unstage/remove them.`,
		);
	}
}

function checkLint(files) {
	log('\n🔍 Running linters on staged files...', COLORS.blue);

	// Filter for lintable files
	const jsFiles = files.filter((f) => /\.(js|ts|tsx|astro)$/.test(f));
	const styleFiles = files.filter((f) => /\.(scss|css)$/.test(f));

	let hasErrors = false;

	if (jsFiles.length > 0) {
		try {
			log(`  • ESLint checking ${jsFiles.length} files...`);
			execSync(`npx eslint ${jsFiles.join(' ')}`, { stdio: 'inherit' });
		} catch (e) {
			hasErrors = true;
			log(`  ❌ ESLint failed.`, COLORS.red);
		}
	}

	if (styleFiles.length > 0) {
		try {
			log(`  • Stylelint checking ${styleFiles.length} files...`);
			execSync(`npx stylelint ${styleFiles.join(' ')}`, { stdio: 'inherit' });
		} catch (e) {
			hasErrors = true;
			log(`  ❌ Stylelint failed.`, COLORS.red);
		}
	}

	if (hasErrors) {
		error('Linting failed. Please fix the errors above.');
	} else {
		log('✅ Linting passed.', COLORS.green);
	}
}

function checkTypes() {
	log('\n📐 Running full type check (Strict Mode)...', COLORS.blue);
	try {
		execSync('pnpm type-check', { stdio: 'inherit' });
		log('✅ Type check passed.', COLORS.green);
	} catch (e) {
		error('Type check failed.');
	}
}

// --- Main ---

function main() {
	const args = process.argv.slice(2);
	const modeIndex = args.indexOf('--mode');
	const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'strict'; // Default to strict

	log(`🛡️  Starting Gatekeeper [Mode: ${mode.toUpperCase()}]`, COLORS.bold);

	const stagedFiles = getStagedFiles();

	if (stagedFiles.length === 0) {
		log('⚠️  No files staged. Nothing to check.', COLORS.yellow);
		return;
	}

	log(`📄 Analyzing ${stagedFiles.length} staged file(s)...`);

	// 1. Universal Guards
	checkForbiddenFiles(stagedFiles);

	// 2. Linting (Both modes)
	checkLint(stagedFiles);

	// 3. Strict Mode Checks
	if (mode === 'strict') {
		const hasTsChanges = stagedFiles.some((f) => /\.(ts|tsx|astro)$/.test(f));
		if (hasTsChanges) {
			checkTypes();
		} else {
			log('\nℹ️  Skipping type check (no TS files changed).');
		}
	}

	log('\n✨ Gatekeeper passed. You are ready to commit.', COLORS.green);

	// Suggest commit command
	log(`\n💡 To commit:\n   git commit -m "type(scope): description"`, COLORS.blue);
}

main();
