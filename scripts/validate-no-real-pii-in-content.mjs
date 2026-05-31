#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CONTENT_DIRS = [
	{ dir: 'events', allowDemo: false },
	{ dir: 'event-demos', allowDemo: true },
];

let exitCode = 0;

for (const { dir, allowDemo } of CONTENT_DIRS) {
	const dirPath = path.join(PROJECT_ROOT, 'src', 'content', dir);
	if (!fs.existsSync(dirPath)) continue;

	const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
	for (const file of files) {
		const fullPath = path.join(dirPath, file);
		let parsed;
		try {
			parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
		} catch {
			continue;
		}

		const isDemo = parsed.isDemo === true;

		if (!allowDemo && !isDemo) {
			console.error(
				`[PII] src/content/${dir}/${file} contains isDemo=false. ` +
					`Real client data must not live in content collections. ` +
					`Use the intake pipeline (intake -> draft -> publish -> DB).`,
			);
			exitCode = 1;
		}
	}
}

if (exitCode === 0) {
	console.log('PII guardrail: no non-demo content files found.');
}

process.exit(exitCode);
