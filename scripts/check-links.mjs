#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { getChangedFiles } from './shared-changed-files.mjs';

function listMarkdownFilesRecursively(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(dir, entry.name);
		if (entry.isDirectory()) return listMarkdownFilesRecursively(target);
		return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
	});
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

function listRelativeLinks(file) {
	const absoluteFile = path.join(process.cwd(), file);
	const contents = readFileSync(absoluteFile, 'utf8');
	const links = [];

	for (const match of contents.matchAll(markdownLinkPattern)) {
		const target = normalizeTarget(match[1]);
		if (!target) continue;
		links.push({ target, resolved: path.resolve(path.dirname(absoluteFile), target) });
	}

	return links;
}

function listRepositoryMarkdownFiles() {
	const result = spawnSync(
		'git',
		['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
		{ cwd: process.cwd(), encoding: 'utf8' },
	);
	if (result.error) throw result.error;
	if ((result.status ?? 1) !== 0) throw new Error(`git ls-files failed:\n${result.stderr}`);
	return String(result.stdout)
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((file) => file && existsSync(file));
}

const checkAll = process.argv.includes('--all');
let markdownFiles;

if (checkAll) {
	const root = process.cwd();
	markdownFiles = [
		...['AGENTS.md', 'README.md', 'CHANGELOG.md']
			.map((f) => path.join(root, f))
			.filter((f) => existsSync(f))
			.map((f) => path.relative(root, f)),
		...['.agent', 'docs'].flatMap((dir) =>
			listMarkdownFilesRecursively(path.join(root, dir)).map((f) => path.relative(root, f)),
		),
	];
} else {
	const changedMarkdown = getChangedFiles().filter((file) => file.endsWith('.md'));
	markdownFiles = changedMarkdown.filter((file) => existsSync(file));

	// Deleted Markdown can break links in unchanged files, so include every file that references one.
	const deletedTargets = new Set(
		changedMarkdown
			.filter((file) => !existsSync(file))
			.map((file) => path.resolve(process.cwd(), file)),
	);
	if (deletedTargets.size > 0) {
		const alreadySelected = new Set(markdownFiles);
		const referrers = listRepositoryMarkdownFiles().filter(
			(file) =>
				!alreadySelected.has(file) &&
				listRelativeLinks(file).some(({ resolved }) => deletedTargets.has(resolved)),
		);
		markdownFiles = [...markdownFiles, ...referrers];
	}
}

if (markdownFiles.length === 0) {
	console.log('No Markdown files to validate.');
	process.exit(0);
}

const failures = [];

for (const file of markdownFiles) {
	for (const { target, resolved } of listRelativeLinks(file)) {
		if (!existsSync(resolved)) {
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
const modeLabel = checkAll ? '' : 'changed ';
console.log(
	`Checked ${markdownFiles.length} ${modeLabel}Markdown ${label}; all relative links resolved.`,
);
