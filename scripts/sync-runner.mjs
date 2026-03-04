#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd());

const { values } = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h' },
		'only-docs': { type: 'boolean' },
		'only-workflows': { type: 'boolean' },
		'only-skills': { type: 'boolean' },
		'stale-days': { type: 'string' }
	},
	strict: false
});

if (values.help) {
	console.log(`
Master coordinator for sync workflows.

Usage:
  pnpm ops sync-runner [options]

Options:
  --help, -h          Show this help message.
  --only-docs         Only run documentation sync.
  --only-workflows    Only run workflows sync.
  --only-skills       Only run skills sync.
  --stale-days N      Number of days to consider stale.
	`);
	process.exit(0);
}

let RUN_DOCS = true;
let RUN_WORKFLOWS = true;
let RUN_SKILLS = true;
let DAYS_STALE = values['stale-days'] || "180";

if (values['only-docs']) {
	RUN_WORKFLOWS = false;
	RUN_SKILLS = false;
}
if (values['only-workflows']) {
	RUN_DOCS = false;
	RUN_SKILLS = false;
}
if (values['only-skills']) {
	RUN_DOCS = false;
	RUN_WORKFLOWS = false;
}

const SUMMARY_FILE = process.env.SUMMARY_FILE || path.join(process.env.TEMP || process.env.TMP || '/tmp', `sync-summary-${new Date().toISOString().split('T')[0]}.txt`);
if (fs.existsSync(SUMMARY_FILE)) {
    fs.writeFileSync(SUMMARY_FILE, '');
} else {
    fs.mkdirSync(path.dirname(SUMMARY_FILE), { recursive: true });
    fs.writeFileSync(SUMMARY_FILE, '');
}

function log(msg) {
	console.log(msg);
	fs.appendFileSync(SUMMARY_FILE, msg + '\n');
}

function runCmd(cmd) {
	try {
        // Ejecutamos en node y mostramos en stdout/err directamente para evitar buffer overflow
		execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });
		fs.appendFileSync(SUMMARY_FILE, `[Executed: ${cmd}]\n`);
	} catch (e) {
		console.error(`Error running command: ${cmd}`);
		fs.appendFileSync(SUMMARY_FILE, `[Failed: ${cmd}]\n${e.message}\n`);
	}
}

log(`🚀 Starting sync runner\n==========================================`);

if (RUN_DOCS) {
	log("📚 DOCUMENTATION SYNC");
	log("------------------------------------------");
	console.log("Running link validation...");
	runCmd("node scripts/check-links.mjs");
	console.log(`Running stale detection (older than ${DAYS_STALE} days)...`);
	runCmd(`node scripts/find-stale.mjs ${DAYS_STALE}`);
	console.log("Running schema validation...");
	runCmd("node scripts/validate-schema.mjs");
	log("");
}

if (RUN_WORKFLOWS) {
	log("💎 WORKFLOW SYNC");
	log("------------------------------------------");
	console.log("Running link validation...");
	runCmd("node scripts/check-links.mjs");
	console.log(`Running stale detection (older than ${DAYS_STALE} days)...`);
	runCmd(`node scripts/find-stale.mjs ${DAYS_STALE}`);
	log("");
}

if (RUN_SKILLS) {
	log("🛠️  SKILLS SYNC");
	log("------------------------------------------");
	console.log("Running link validation...");
	runCmd("node scripts/check-links.mjs");
	console.log(`Running stale detection (older than ${DAYS_STALE} days)...`);
	runCmd(`node scripts/find-stale.mjs ${DAYS_STALE}`);
	log("");
}

log("==========================================");
log("✅ Sync runner completed");
log(`Summary saved to: ${SUMMARY_FILE}\n`);
console.log(`Next steps:`);
console.log(`1. Review the output above for errors/warnings.`);
console.log(`2. Execute the relevant sync workflows for remediation:`);
console.log(`   - .agent/workflows/evergreen/system-doc-alignment.md`);
console.log(`3. Update DOC_STATUS.md with findings.\n`);
