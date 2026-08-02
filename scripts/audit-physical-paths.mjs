import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const PROJECT_ROOT = process.cwd();

// Target directories and files for audit
const TARGET_PATHS = ['src', 'scripts', '.agent', 'docs', 'tests', 'AGENTS.md'];

// Patterns for physical/absolute machine paths
const PHYSICAL_PATH_PATTERNS = [
	{ name: 'Windows D: Drive Path', regex: /D:[/\\]code[/\\][^\s` '")]+/gi },
	{ name: 'Windows C: Users Path', regex: /C:[/\\]Users[/\\][^\s` '")]+/gi },
	{ name: 'File Protocol URI', regex: /file:\/\/\/[^\s` '")]+/gi },
	{ name: 'CI Absolute Path', regex: /\/home\/runner\/work\/[^\s` '")]+/gi },
];

function walkDir(dir, fileList = []) {
	try {
		const files = readdirSync(dir);
		for (const file of files) {
			if (
				file === 'node_modules' ||
				file === '.git' ||
				file === '.astro' ||
				file === 'dist'
			) {
				continue;
			}
			const filePath = join(dir, file);
			const stat = statSync(filePath);
			if (stat.isDirectory()) {
				walkDir(filePath, fileList);
			} else {
				fileList.push(filePath);
			}
		}
	} catch {
		if (statSync(dir).isFile()) {
			fileList.push(dir);
		}
	}
	return fileList;
}

export function auditPhysicalPaths() {
	const allFiles = [];
	for (const target of TARGET_PATHS) {
		const absTarget = resolve(PROJECT_ROOT, target);
		walkDir(absTarget, allFiles);
	}

	const findings = [];
	const summary = {};

	for (const filePath of allFiles) {
		const relPath = relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
		const isArchived =
			relPath.startsWith('docs/archive/') || relPath.startsWith('.agent/plans/archived/');

		let content;
		try {
			content = readFileSync(filePath, 'utf8');
		} catch {
			continue;
		}

		const lines = content.split(/\r?\n/);
		lines.forEach((lineText, idx) => {
			for (const p of PHYSICAL_PATH_PATTERNS) {
				p.regex.lastIndex = 0;
				let match;
				while ((match = p.regex.exec(lineText)) !== null) {
					const matchStr = match[0];
					if (matchStr.includes('file:///workspace/')) continue;
					findings.push({
						file: relPath,
						line: idx + 1,
						pattern: p.name,
						match: matchStr,
						isArchived,
					});
					summary[p.name] = (summary[p.name] || 0) + 1;
				}
			}
		});
	}

	return { findings, summary };
}

console.log('================================================================');
console.log(' Celebra-me Physical Path Audit');
console.log('================================================================\n');

const { findings, summary } = auditPhysicalPaths();
const activeFindings = findings.filter((f) => !f.isArchived);
const archivedFindings = findings.filter((f) => f.isArchived);

console.log(`Total Physical Path Findings: ${findings.length}`);
console.log(`- Active Code & Docs:         ${activeFindings.length}`);
console.log(`- Archived / Historical Docs: ${archivedFindings.length}\n`);

console.log('--- FINDINGS BREAKDOWN ---');
for (const [pattern, count] of Object.entries(summary)) {
	console.log(`  ${pattern.padEnd(25)}: ${count}`);
}
console.log('');

if (activeFindings.length > 0) {
	console.log('--- ACTIVE FINDINGS DETAILS ---');
	for (const f of activeFindings) {
		console.log(`  ${f.file}:${f.line} [${f.pattern}] -> ${f.match}`);
	}
	console.log('');
}

if (archivedFindings.length > 0) {
	console.log(
		`--- ARCHIVED HISTORICAL FINDINGS (${archivedFindings.length} items preserved) ---`,
	);
	for (const f of archivedFindings.slice(0, 10)) {
		console.log(`  ${f.file}:${f.line} [${f.pattern}] -> ${f.match}`);
	}
	if (archivedFindings.length > 10) {
		console.log(`  ... and ${archivedFindings.length - 10} more archived lines.`);
	}
	console.log('');
}
