#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const { values } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' }
	},
	strict: false
});

if (values.help) {
	console.log(`
Validate internal links in documentation and workflows.

Usage:
  pnpm ops check-links [options]

Options:
  --help, -h    Show this help message.
	`);
	process.exit(0);
}

console.log(`🔗 Starting link validation check...`);
console.log(`Project root: ${PROJECT_ROOT}`);
console.log(`=====================================`);

let ERRORS = 0;
let CHECKED = 0;

function checkLink(file, link, lineNum) {
	if (/^(http|https|ftp):\/\//.test(link) || /^mailto:/.test(link)) return 0;

	link = link.split('#')[0];
	if (!link) return 0;

	let targetPath;
	if (link.startsWith('/')) {
		targetPath = path.join(PROJECT_ROOT, link.substring(1));
	} else if (link.startsWith('./')) {
		targetPath = path.join(path.dirname(file), link.substring(2));
	} else if (link.startsWith('../')) {
		targetPath = path.join(path.dirname(file), link);
	} else {
		targetPath = path.join(path.dirname(file), link);
	}

	if (fs.existsSync(targetPath)) {
		console.log(`  ✅ ${link}`);
		return 0;
	} else {
		console.log(`  ❌ ${link} (line ${lineNum}) - File not found: ${path.relative(PROJECT_ROOT, targetPath)}`);
		return 1;
	}
}

function checkFile(file) {
	if (!fs.existsSync(file)) return;
	const content = fs.readFileSync(file, 'utf8');
	const lines = content.split('\n');

	let linksFound = 0;
	// match markdown links
	const regex = /\[[^\]]+\]\(([^)]+)\)/g;

	let firstMatch = true;
	lines.forEach((line, index) => {
		let match;
		while ((match = regex.exec(line)) !== null) {
			if (firstMatch) {
				console.log(`Checking: ${path.relative(PROJECT_ROOT, file)}`);
				firstMatch = false;
			}
			const link = match[1];
			if (link) {
				if (checkLink(file, link, index + 1) === 1) ERRORS++;
				CHECKED++;
				linksFound++;
			}
		}
	});

	if (linksFound > 0) {
		console.log(`  Found ${linksFound} links`);
	}
}

// walk directory function
function walkDir(dir, pattern, fileList = []) {
	if (!fs.existsSync(dir)) return fileList;
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		if (fs.statSync(filePath).isDirectory()) {
			walkDir(filePath, pattern, fileList);
		} else if (pattern.test(filePath)) {
			fileList.push(filePath);
		}
	}
	return fileList;
}

console.log(`Phase 1: Checking documentation files...`);
const docsDir = path.join(PROJECT_ROOT, 'docs');
if (fs.existsSync(docsDir)) {
	walkDir(docsDir, /\.md$/).forEach(checkFile);
}

console.log(`\nPhase 2: Checking workflow files...`);
const workflowsDir = path.join(PROJECT_ROOT, '.agent/workflows');
if (fs.existsSync(workflowsDir)) {
	walkDir(workflowsDir, /\.md$/).forEach(checkFile);
}

console.log(`\nPhase 3: Checking skill files...`);
const skillsDir = path.join(PROJECT_ROOT, '.agent/skills');
if (fs.existsSync(skillsDir)) {
	walkDir(skillsDir, /\.md$/).forEach(checkFile);
}

console.log(`\n=====================================`);
console.log(`Link validation complete!`);
console.log(`Total links checked: ${CHECKED}`);
console.log(`Errors found: ${ERRORS}`);

if (ERRORS === 0) {
	console.log(`✅ All links are valid!`);
	process.exit(0);
} else {
	console.log(`❌ Found ${ERRORS} broken links\n`);
	console.log(`Next steps:`);
	console.log(`1. Review the broken links above`);
	console.log(`2. Update links to point to existing files`);
	console.log(`3. Run this check again to verify fixes`);
	process.exit(1);
}
