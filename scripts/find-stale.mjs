#!/usr/bin/env node
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());

const { values, positionals } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' },
		days: { type: 'string', short: 'd' }
	},
	strict: false
});

const DEFAULT_DAYS = 180;
const DAYS = parseInt(values.days || positionals[0] || DEFAULT_DAYS, 10);

if (values.help || isNaN(DAYS)) {
	console.log(`
Detect stale files based on modification time.

Usage:
  pnpm ops find-stale [options] [days]

Options:
  --help, -h    Show this help message.
  --days, -d    Number of days (default 180).
	`);
	process.exit(0);
}

console.log(`🔍 Searching for stale files (older than ${DAYS} days)...`);
console.log(`========================================================`);

let STALE_COUNT = 0;
let TOTAL_CHECKED = 0;

function checkDirectory(dirRel, pattern, description) {
	console.log(`\n${description}:`);
	console.log(`----------------------------------------`);

	const dirAbs = path.join(PROJECT_ROOT, dirRel);
	if (!fs.existsSync(dirAbs)) {
		console.log(`  ✅ Directory not found, skipping`);
		return;
	}

	let found = 0;

	function walk(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const res = path.resolve(dir, entry.name);
			if (entry.isDirectory()) {
				walk(res);
			} else {
				if (new RegExp(pattern.replace(/\*/g, '.*') + '$').test(entry.name)) {
					TOTAL_CHECKED++;
					const modTime = fs.statSync(res).mtimeMs;
					const now = Date.now();
					const daysOld = Math.floor((now - modTime) / 86400000);

					if (daysOld > DAYS) {
						console.log(`  ⚠️  ${path.relative(PROJECT_ROOT, res)} (${daysOld} days old)`);
						found++;
						STALE_COUNT++;
					}
				}
			}
		}
	}

	walk(dirAbs);

	if (found === 0) {
		console.log(`  ✅ No stale files found`);
	}
}

console.log(`Phase 1: Checking documentation...`);
checkDirectory("docs", "*.md", "Documentation files");

console.log(`\nPhase 2: Checking workflows...`);
checkDirectory(".agent/workflows", "*.md", "Workflow files");

console.log(`\nPhase 3: Checking skills...`);
checkDirectory(".agent/skills", "*.md", "Skill files");

console.log(`\nPhase 4: Checking source code...`);
checkDirectory("src", "*.ts", "TypeScript files");
checkDirectory("src", "*.tsx", "TypeScript React files");
checkDirectory("src", "*.astro", "Astro files");
checkDirectory("src/styles", "*.scss", "SCSS files");

console.log(`\n========================================================`);
console.log(`Stale file detection complete!`);
console.log(`Total files checked: ${TOTAL_CHECKED}`);
console.log(`Stale files found: ${STALE_COUNT}`);

if (STALE_COUNT === 0) {
	console.log(`✅ No stale files detected!\n`);
	console.log(`Recommendation:`);
	console.log(`- Continue regular maintenance schedule`);
} else {
	console.log(`⚠️  Found ${STALE_COUNT} potentially stale files\n`);
	console.log(`Next steps:`);
	console.log(`1. Review each stale file above`);
	console.log(`2. Determine if file is still needed`);
	console.log(`3. If obsolete:`);
	console.log(`   - Archive: Move to appropriate archive directory`);
	console.log(`   - Update: Refresh content if still relevant`);
	console.log(`   - Delete: Remove if completely obsolete (update references first)`);
	console.log(`4. Update documentation to reflect changes\n`);
	console.log(`Automation notes:`);
	console.log(`- Files > 180 days (6 months) may need review`);
	console.log(`- Files > 365 days (1 year) likely need archiving`);
	console.log(`- Consider project velocity when setting thresholds`);
}
process.exit(0);
