import fs from 'fs';
import path from 'path';

/**
 * Diagnostic Engine: Context Extractor
 * Reads a specific line range from a file and outputs it with line numbers prepended.
 *
 * Usage: node context-extractor.mjs <file-path> <line-number> [radius]
 * Example: node context-extractor.mjs src/components/RSVP.tsx 45 10
 */

const targetFile = process.argv[2];
const targetLine = parseInt(process.argv[3], 10);
const radius = parseInt(process.argv[4], 10) || 10;

if (!targetFile || isNaN(targetLine)) {
	console.error('Error: Missing or invalid arguments.');
	console.error('Usage: node context-extractor.mjs <file-path> <line-number> [radius]');
	process.exit(1);
}

try {
	const absolutePath = path.resolve(targetFile);
	if (!fs.existsSync(absolutePath)) {
		console.error(`Error: File not found at ${absolutePath}`);
		process.exit(1);
	}

	const content = fs.readFileSync(absolutePath, 'utf-8');
	const lines = content.split('\n');

	// 1-indexed lines to 0-indexed array
	const targetIdx = targetLine - 1;

	if (targetIdx < 0 || targetIdx >= lines.length) {
		console.error(
			`Error: Target line ${targetLine} is out of bounds (file has ${lines.length} lines).`,
		);
		process.exit(1);
	}

	const startIdx = Math.max(0, targetIdx - radius);
	const endIdx = Math.min(lines.length - 1, targetIdx + radius);

	const extracted = [];
	extracted.push(`--- Context for ${absolutePath} (Lines ${startIdx + 1}-${endIdx + 1}) ---`);

	for (let i = startIdx; i <= endIdx; i++) {
		const lineNum = String(i + 1).padStart(4, ' ');
		const marker = i === targetIdx ? '>' : ' ';
		extracted.push(`${marker} ${lineNum} | ${lines[i]}`);
	}

	console.info(extracted.join('\n'));
} catch (err) {
	console.error(`Error extracting context: ${err.message}`);
	process.exit(1);
}
