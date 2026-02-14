import { spawnSync } from 'child_process';

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

function runCommand(command, args = [], options = {}) {
	const result = spawnSync(command, args, {
		encoding: 'utf8',
		stdio: options.stdio ?? 'pipe',
		shell: options.shell ?? process.platform === 'win32',
	});

	if (result.error) {
		throw result.error;
	}

	if (typeof result.status === 'number' && result.status !== 0 && !options.ignoreError) {
		const errorOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
		throw new Error(
			`Command failed (${command} ${args.join(' ')}): ${errorOutput || `exit ${result.status}`}`,
		);
	}

	return {
		status: result.status ?? 0,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	};
}

function getStagedFiles() {
	try {
		const { stdout } = runCommand('git', ['diff', '--name-only', '--cached']);
		const output = stdout.trim();
		if (!output) return [];
		return output
			.split('\n')
			.map((file) => file.trim())
			.filter(Boolean);
	} catch (e) {
		const fromEnv = process.env.GATEKEEPER_STAGED_FILES;
		if (fromEnv) {
			return fromEnv
				.split(',')
				.map((file) => file.trim())
				.filter(Boolean);
		}
		if (e?.code === 'EPERM') {
			error(
				'Cannot spawn child processes in this environment (EPERM). ' +
					'Run gatekeeper outside the sandbox or set GATEKEEPER_STAGED_FILES.',
			);
		}
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
			runCommand('npx', ['eslint', ...jsFiles], { stdio: 'inherit' });
		} catch {
			hasErrors = true;
			log(`  ❌ ESLint failed.`, COLORS.red);
		}
	}

	if (styleFiles.length > 0) {
		try {
			log(`  • Stylelint checking ${styleFiles.length} files...`);
			runCommand('npx', ['stylelint', ...styleFiles], { stdio: 'inherit' });
		} catch {
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
		runCommand('pnpm', ['type-check'], { stdio: 'inherit' });
		log('✅ Type check passed.', COLORS.green);
	} catch {
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
