#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getChangedFiles } from './shared-changed-files.mjs';
import { isActiveMarkdownPath } from './markdownlint/table-readability.mjs';

const MARKDOWNLINT_BIN = path.resolve('node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs');

function normalizePath(file) {
	const candidate = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file;
	return candidate.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function getActiveMarkdownFiles(files) {
	return [
		...new Set(
			files
				.map(normalizePath)
				.filter((file) => isActiveMarkdownPath(file) && existsSync(file)),
		),
	];
}

function listTrackedMarkdownFiles() {
	const result = spawnSync('git', ['ls-files', '--', '*.md'], { encoding: 'utf8' });
	if (result.error) throw result.error;
	if ((result.status ?? 1) !== 0)
		throw new Error(result.stderr || 'Unable to list Markdown files.');
	return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function parseArguments(argv) {
	const filesIndex = argv.indexOf('--files');
	const allActive = argv.includes('--all-active');
	const fix = argv.includes('--fix');

	if (filesIndex >= 0) {
		return {
			files: argv.slice(filesIndex + 1).filter((argument) => !argument.startsWith('--')),
			fix,
		};
	}

	return {
		files: allActive ? listTrackedMarkdownFiles() : getChangedFiles(),
		fix,
	};
}

function main() {
	const { files, fix } = parseArguments(process.argv.slice(2));
	const activeFiles = getActiveMarkdownFiles(files);
	if (activeFiles.length === 0) {
		console.log('No active Markdown files to validate.');
		return;
	}

	const args = [MARKDOWNLINT_BIN, '--no-globs'];
	if (fix) args.push('--fix');
	args.push('--', ...activeFiles);
	const result = spawnSync(process.execPath, args, {
		cwd: process.cwd(),
		stdio: 'inherit',
	});
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
	main();
}
