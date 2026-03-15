import fs from 'fs';
import path from 'path';

/**
 * Diagnostic Engine: Error Classifier
 * Reads raw stderr/stdout from tools and outputs a structured JSON DiagnosticReport.
 */

// Schema definition for the output
const DEFAULT_REPORT = {
	tool: 'unknown',
	type: 'unknown',
	file: null,
	line: null,
	column: null,
	message: 'Could not classify error',
	snippet: '',
	complexity: 'complex',
	autoFixable: false,
};

function parseLog(log) {
	const report = { ...DEFAULT_REPORT };
	const lines = log.split('\n');

	// 1. TypeScript (tsc / astro check)
	// Example: src/components/RSVP.tsx:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.
	const tsRegex = /([\w./-]+):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.+)/;
	const tsMatch = log.match(tsRegex);
	if (tsMatch) {
		report.tool = 'typescript';
		report.type = 'type-error';
		report.file = path.resolve(tsMatch[1]);
		report.line = parseInt(tsMatch[2], 10);
		report.column = parseInt(tsMatch[3], 10);
		report.message = `[${tsMatch[4]}] ${tsMatch[5]}`;
		report.snippet = extractSnippet(lines, log.indexOf(tsMatch[0]));
		return report;
	}

	// 2. ESLint
	// Example: c:\Code\celebra-me\src\pages\index.astro
	//   14:1  error  Unexpected var, use let or const instead  no-var
	const eslintRegex = /(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z-]+(?:\/[a-z-]+)*)/i;
	if (log.includes('eslint') || log.match(eslintRegex)) {
		// Try to find file above it
		const fileLine = lines.find((l) => l.startsWith('c:\\') || l.startsWith('/'));
		const lintMatch = log.match(eslintRegex);
		if (lintMatch && fileLine) {
			report.tool = 'eslint';
			report.type = 'lint-error';
			report.file = fileLine.trim();
			report.line = parseInt(lintMatch[1], 10);
			report.column = parseInt(lintMatch[2], 10);
			report.message = `[${lintMatch[5]}] ${lintMatch[4]}`;
			report.snippet = extractSnippet(lines, log.indexOf(lintMatch[0]));
			return report;
		}
	}

	// 3. Stylelint
	// Example: src/styles/_global.scss
	//  12:3  ✖  Expected a trailing semicolon  declaration-block-trailing-semicolon
	if (log.includes('stylelint')) {
		report.tool = 'stylelint';
		report.type = 'style-error';
		const stylelintRegex = /(\d+):(\d+)\s+✖\s+(.+?)\s+([a-z-]+)/;
		const match = log.match(stylelintRegex);
		if (match) {
			report.line = parseInt(match[1], 10);
			report.column = parseInt(match[2], 10);
			report.message = `[${match[4]}] ${match[3]}`;
			// Extract file loosely
			const fileLine = lines.find((l) => l.endsWith('.scss') || l.endsWith('.css'));
			if (fileLine) report.file = fileLine.trim();
			report.snippet = extractSnippet(lines, log.indexOf(match[0]));
		}
		return report;
	}

	// 4. Jest / Playwright
	// Example: FAIL tests/unit/event.adapter.test.ts
	if (log.includes('FAIL ') && (log.includes('tests/') || log.includes('e2e/'))) {
		report.tool = log.includes('playwright') ? 'playwright' : 'jest';
		report.type = 'test-failure';

		// Find the root failing test file
		const fileMatch = log.match(/FAIL\s+([\w./-]+)/);
		if (fileMatch) report.file = path.resolve(fileMatch[1]);

		// Try standard assertion failures
		const expectMatch = log.match(/Expected:\s*(.+?)\r?\n\s*Received:\s*(.+?)\r?\n/m);
		if (expectMatch) {
			report.message = `Assertion failed: Expected ${expectMatch[1].trim()}, Received ${expectMatch[2].trim()}`;
		} else {
			// Try catching SyntaxError or generic Error within the block
			const errMatch = log.match(/(SyntaxError|TypeError|Error):\s*(.+?)\r?\n/);
			if (errMatch) {
				report.message = `[${errMatch[1]}] ${errMatch[2].trim()}`;
			}
		}

		// Try to find the exact line in source code (not internal node_modules)
		const srcLineMatch = log.match(/([\w./\\]+):(\d+):(\d+)\r?\n\s+\(cov_/);
		if (srcLineMatch) {
			report.file = path.resolve(srcLineMatch[1]);
			report.line = parseInt(srcLineMatch[2], 10);
			report.column = parseInt(srcLineMatch[3], 10);
		} else {
			const lineMatch = log.match(
				/at\s+.*?\s+\(?([a-zA-Z]:\\[\w.\-\\]+|[\w./-]+):(\d+):(\d+)\)?/,
			);
			if (lineMatch) {
				report.line = parseInt(lineMatch[2], 10);
				report.column = parseInt(lineMatch[3], 10);
				if (!report.file) report.file = lineMatch[1];
			}
		}

		report.snippet = extractSnippet(lines, log.indexOf('FAIL '));

		// Example check for trivial fixes (e.g. typos, unused vars caught by lint, etc)
		if (
			report.message &&
			report.message.match(/is not defined|Cannot find name|Missing semicolon/i)
		) {
			report.complexity = 'trivial';
			report.autoFixable = false; // Requires logic but is trivial
		}

		return report;
	}

	// 5. Astro Build / Hydration
	if (log.includes('astro build') || log.includes('AstroError') || log.includes('Hydration')) {
		report.tool = 'astro';
		report.type = log.includes('hydration') ? 'astro-hydration' : 'astro-build';

		const astroMsg = log.match(/AstroError:\s+(.+)/);
		if (astroMsg) report.message = astroMsg[1];

		// Often traces look like: at Component (src/components/foo.astro:4:12)
		const traceMatch = log.match(/src\/[\w./-]+:(\d+):(\d+)/);
		if (traceMatch) {
			report.file = path.resolve(traceMatch[0].split(':')[0]);
			report.line = parseInt(traceMatch[1], 10);
			report.column = parseInt(traceMatch[2], 10);
		}
		report.snippet = extractSnippet(
			lines,
			log.indexOf('AstroError') > -1 ? log.indexOf('AstroError') : 0,
		);
		return report;
	}

	// Fallback: Try to find ANY file path in a stack trace
	const genericTrace = log.match(/at\s+.*?\s+\(?([a-zA-Z]:\\[\w.\-\\]+|[\w./-]+):(\d+):(\d+)\)?/);
	if (genericTrace) {
		report.type = 'runtime';
		report.file = genericTrace[1];
		report.line = parseInt(genericTrace[2], 10);
		report.column = parseInt(genericTrace[3], 10);
		report.message = lines.find((l) => l.includes('Error:')) || 'Runtime error detected';
		report.snippet = extractSnippet(lines, log.indexOf(genericTrace[0]));
		return report;
	}

	report.message = 'Unknown error format. Could not classify.';
	return report;
}

// Extracts ~5 lines of context around the match index
function extractSnippet(lines, matchIndexChars) {
	if (matchIndexChars === -1) return '';

	// Find which line number the match character index corresponds to
	let currentChars = 0;
	let matchLineIdx = 0;
	for (let i = 0; i < lines.length; i++) {
		currentChars += lines[i].length + 1; // +1 for newline
		if (currentChars > matchIndexChars) {
			matchLineIdx = i;
			break;
		}
	}

	const start = Math.max(0, matchLineIdx - 2);
	const end = Math.min(lines.length, matchLineIdx + 4);
	return lines.slice(start, end).join('\n');
}

// CLI Entrypoint
let input = '';
if (process.argv[2]) {
	try {
		if (!fs.existsSync(process.argv[2])) {
			// Might be a raw string passed as an argument instead of a file
			parseAndPrint(process.argv[2]);
		} else {
			input = fs.readFileSync(process.argv[2], 'utf-8');
			parseAndPrint(input);
		}
	} catch (err) {
		console.error(
			JSON.stringify({ ...DEFAULT_REPORT, message: `Failed to read: ${err.message}` }),
		);
		process.exit(1);
	}
} else if (!process.stdin.isTTY) {
	process.stdin.setEncoding('utf-8');
	process.stdin.on('data', (chunk) => {
		input += chunk;
	});
	process.stdin.on('end', () => {
		parseAndPrint(input);
	});
} else {
	console.error(
		JSON.stringify({ ...DEFAULT_REPORT, message: 'No input provided via stdin or argument.' }),
	);
	process.exit(1);
}

function parseAndPrint(data) {
	const report = parseLog(data);
	console.info(JSON.stringify(report, null, 2));
}
