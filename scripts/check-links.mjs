#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getChangedFiles } from './shared-changed-files.mjs';

const markdownFiles = getChangedFiles().filter((file) => file.endsWith('.md'));

if (markdownFiles.length === 0) {
	console.log('No changed Markdown files to validate.');
	process.exit(0);
}

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;

function normalizeTarget(rawTarget) {
	const withoutTitle = rawTarget.trim().replace(/^<|>$/gu, '').split(/\s+"/u)[0];

	if (
		withoutTitle.startsWith('#') ||
		/^(?:[a-z]+:|\/\/)/iu.test(withoutTitle) ||
		/^[a-z]:[\\/]/iu.test(withoutTitle) ||
		path.isAbsolute(withoutTitle)
	) {
		return null;
	}

	return withoutTitle.split('#')[0];
}

const failures = [];

for (const file of markdownFiles) {
	const absoluteFile = path.join(process.cwd(), file);
	const contents = readFileSync(absoluteFile, 'utf8');

	for (const match of contents.matchAll(markdownLinkPattern)) {
		const rawTarget = match[1];
		const target = normalizeTarget(rawTarget);

		if (!target) continue;

		const resolvedTarget = path.resolve(path.dirname(absoluteFile), target);
		if (!existsSync(resolvedTarget)) {
			failures.push(`${file}: missing relative link target "${target}"`);
		}
	}
}

if (failures.length > 0) {
	console.error('Documentation link check failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

const label = markdownFiles.length === 1 ? 'file' : 'files';
console.log(
	`Checked ${markdownFiles.length} changed Markdown ${label}; all relative links resolved.`,
);
