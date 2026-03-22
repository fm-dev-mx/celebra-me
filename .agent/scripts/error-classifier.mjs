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

const TS_REGEX = /([\w./-]+):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.+)/;
const ESLINT_REGEX = /(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z-]+(?:\/[a-z-]+)*)/i;
const STYLELINT_REGEX = /(\d+):(\d+)\s+✖\s+(.+?)\s+([a-z-]+)/;
const FAIL_FILE_REGEX = /FAIL\s+([\w./-]+)/;
const EXPECT_REGEX = /Expected:\s*(.+?)\r?\n\s*Received:\s*(.+?)\r?\n/m;
const GENERIC_ERROR_REGEX = /(SyntaxError|TypeError|Error):\s*(.+?)\r?\n/;
const COVERAGE_TRACE_REGEX = /([\w./\\]+):(\d+):(\d+)\r?\n\s+\(cov_/;
const STACK_TRACE_REGEX = /at\s+.*?\s+\(?([a-zA-Z]:\\[\w.\-\\]+|[\w./-]+):(\d+):(\d+)\)?/;
const ASTRO_TRACE_REGEX = /src\/[\w./-]+:(\d+):(\d+)/;

function buildReport() {
	return { ...DEFAULT_REPORT };
}

function parseTypescript(log, lines) {
	const match = log.match(TS_REGEX);
	if (!match) return null;

	const report = buildReport();
	report.tool = 'typescript';
	report.type = 'type-error';
	report.file = path.resolve(match[1]);
	report.line = parseInt(match[2], 10);
	report.column = parseInt(match[3], 10);
	report.message = `[${match[4]}] ${match[5]}`;
	report.snippet = extractSnippet(lines, log.indexOf(match[0]));
	return report;
}

function parseEslint(log, lines) {
	if (!log.includes('eslint') && !log.match(ESLINT_REGEX)) return null;

	const fileLine = lines.find((line) => line.startsWith('c:\\') || line.startsWith('/'));
	const match = log.match(ESLINT_REGEX);
	if (!match || !fileLine) return null;

	const report = buildReport();
	report.tool = 'eslint';
	report.type = 'lint-error';
	report.file = fileLine.trim();
	report.line = parseInt(match[1], 10);
	report.column = parseInt(match[2], 10);
	report.message = `[${match[5]}] ${match[4]}`;
	report.snippet = extractSnippet(lines, log.indexOf(match[0]));
	return report;
}

function parseStylelint(log, lines) {
	if (!log.includes('stylelint')) return null;

	const report = buildReport();
	report.tool = 'stylelint';
	report.type = 'style-error';

	const match = log.match(STYLELINT_REGEX);
	if (!match) return report;

	report.line = parseInt(match[1], 10);
	report.column = parseInt(match[2], 10);
	report.message = `[${match[4]}] ${match[3]}`;
	const fileLine = lines.find((line) => line.endsWith('.scss') || line.endsWith('.css'));
	if (fileLine) report.file = fileLine.trim();
	report.snippet = extractSnippet(lines, log.indexOf(match[0]));
	return report;
}

function parseTestFailure(log, lines) {
	if (!log.includes('FAIL ') || (!log.includes('tests/') && !log.includes('e2e/'))) {
		return null;
	}

	const report = buildReport();
	report.tool = log.includes('playwright') ? 'playwright' : 'jest';
	report.type = 'test-failure';

	const fileMatch = log.match(FAIL_FILE_REGEX);
	if (fileMatch) report.file = path.resolve(fileMatch[1]);

	const expectMatch = log.match(EXPECT_REGEX);
	if (expectMatch) {
		report.message = `Assertion failed: Expected ${expectMatch[1].trim()}, Received ${expectMatch[2].trim()}`;
	} else {
		const errorMatch = log.match(GENERIC_ERROR_REGEX);
		if (errorMatch) report.message = `[${errorMatch[1]}] ${errorMatch[2].trim()}`;
	}

	const sourceTrace = log.match(COVERAGE_TRACE_REGEX) || log.match(STACK_TRACE_REGEX);
	if (sourceTrace) {
		report.file = report.file || path.resolve(sourceTrace[1]);
		report.line = parseInt(sourceTrace[2], 10);
		report.column = parseInt(sourceTrace[3], 10);
	}

	report.snippet = extractSnippet(lines, log.indexOf('FAIL '));
	if (report.message.match(/is not defined|Cannot find name|Missing semicolon/i)) {
		report.complexity = 'trivial';
		report.autoFixable = false;
	}

	return report;
}

function parseAstro(log, lines) {
	if (!log.includes('astro build') && !log.includes('AstroError') && !log.includes('Hydration')) {
		return null;
	}

	const report = buildReport();
	report.tool = 'astro';
	report.type = log.includes('hydration') ? 'astro-hydration' : 'astro-build';

	const messageMatch = log.match(/AstroError:\s+(.+)/);
	if (messageMatch) report.message = messageMatch[1];

	const traceMatch = log.match(ASTRO_TRACE_REGEX);
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

function parseRuntimeFallback(log, lines) {
	const match = log.match(STACK_TRACE_REGEX);
	if (!match) return null;

	const report = buildReport();
	report.type = 'runtime';
	report.file = match[1];
	report.line = parseInt(match[2], 10);
	report.column = parseInt(match[3], 10);
	report.message = lines.find((line) => line.includes('Error:')) || 'Runtime error detected';
	report.snippet = extractSnippet(lines, log.indexOf(match[0]));
	return report;
}

function parseLog(log) {
	const lines = log.split('\n');
	const parsers = [
		parseTypescript,
		parseEslint,
		parseStylelint,
		parseTestFailure,
		parseAstro,
		parseRuntimeFallback,
	];

	for (const parser of parsers) {
		const parsed = parser(log, lines);
		if (parsed) return parsed;
	}

	const report = buildReport();
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
