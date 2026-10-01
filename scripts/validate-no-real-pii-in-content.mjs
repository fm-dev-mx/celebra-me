#!/usr/bin/env node
/**
 * PII guardrail for static content collections.
 *
 * Real client data must live in the database (intake -> draft -> publish), never in
 * `src/content/**`. The guard fails closed: a required content root that is missing or holds no
 * JSON files is an error, so a moved or restructured collection cannot turn it into a no-op.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CONTENT_ROOTS = [
	// Demo showroom collection, loaded recursively (`src/content/event-demos/<eventType>/*.json`).
	{ dir: 'event-demos', required: true },
	// Legacy static events collection, replaced by DB-first resolution. If it reappears it may
	// only hold demo fixtures.
	{ dir: 'events', required: false },
];

const SHOWROOM_DATA_FILE = 'src/data/demo-showroom.data.ts';
const SHOWROOM_ITEMS_EXPORT = 'DEMO_SHOWROOM_ITEMS';
// Demo-owned visual profiles carry this prefix; any other profile id belongs to a real client.
const DEMO_PROFILE_PREFIX = 'demo-';
const QUARANTINE = { visibility: 'hidden', reviewStatus: 'needs-review' };

function toRepoPath(absolutePath) {
	return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');
}

function listJsonFiles(dirPath) {
	return fs
		.readdirSync(dirPath, { withFileTypes: true })
		.sort((a, b) => a.name.localeCompare(b.name))
		.flatMap((entry) => {
			const target = path.join(dirPath, entry.name);
			if (entry.isDirectory()) return listJsonFiles(target);
			return entry.isFile() && entry.name.endsWith('.json') ? [target] : [];
		});
}

const QUOTES = new Set(["'", '"', '`']);

/** Returns the index of the closing quote of the string literal that opens at `start`. */
function findStringEnd(source, start) {
	const quote = source[start];
	for (let i = start + 1; i < source.length; i++) {
		if (source[i] === '\\') {
			i++;
			continue;
		}
		if (source[i] === quote) return i;
	}
	return source.length - 1;
}

/** Returns the index of the last character of a comment that opens at `start`, or -1. */
function findCommentEnd(source, start) {
	if (source[start] !== '/') return -1;
	if (source[start + 1] === '/') {
		const end = source.indexOf('\n', start);
		return end === -1 ? source.length - 1 : end - 1;
	}
	if (source[start + 1] === '*') {
		const end = source.indexOf('*/', start + 2);
		return end === -1 ? source.length - 1 : end + 1;
	}
	return -1;
}

/**
 * Returns the source of each top-level object literal in the exported array `name`, with nested
 * objects/arrays and comments removed so property lookups only see the item's own keys.
 */
function extractArrayItems(source, name) {
	const declaration = new RegExp(`\\b${name}\\b[^=]*=\\s*\\[`).exec(source);
	if (!declaration) return [];

	const items = [];
	let depth = 0;
	let current = '';
	for (let i = declaration.index + declaration[0].length; i < source.length; i++) {
		const char = source[i];
		const commentEnd = findCommentEnd(source, i);
		if (commentEnd !== -1) {
			i = commentEnd;
			continue;
		}
		if (QUOTES.has(char)) {
			const end = findStringEnd(source, i);
			if (depth === 1) current += source.slice(i, end + 1);
			i = end;
			continue;
		}
		if (char === '{' || char === '[') {
			depth++;
			if (depth === 1) current = '';
			continue;
		}
		if (char === '}' || char === ']') {
			if (depth === 0) break;
			depth--;
			if (depth === 0) items.push(current);
			continue;
		}
		if (depth === 1) current += char;
	}
	return items;
}

function readStringProperty(itemSource, key) {
	const match = new RegExp(`(?:^|[\\s,])${key}\\s*:\\s*(['"\`])(.*?)\\1`).exec(itemSource);
	return match?.[2];
}

/** Maps showroom slugs to their exposure state, or returns null when the data cannot be read. */
function loadShowroomItems() {
	const filePath = path.join(PROJECT_ROOT, SHOWROOM_DATA_FILE);
	if (!fs.existsSync(filePath)) return null;

	const items = new Map();
	for (const itemSource of extractArrayItems(
		fs.readFileSync(filePath, 'utf8'),
		SHOWROOM_ITEMS_EXPORT,
	)) {
		const slug = readStringProperty(itemSource, 'slug');
		if (!slug) continue;
		items.set(slug, {
			visibility: readStringProperty(itemSource, 'visibility'),
			reviewStatus: readStringProperty(itemSource, 'reviewStatus'),
		});
	}
	return items.size > 0 ? items : null;
}

const errors = [];
const clientProfileDemos = [];
let checkedFiles = 0;

for (const { dir, required } of CONTENT_ROOTS) {
	const dirPath = path.join(PROJECT_ROOT, 'src', 'content', dir);
	const repoDir = toRepoPath(dirPath);
	if (!fs.existsSync(dirPath)) {
		if (required) {
			errors.push(
				`${repoDir} is missing. Update CONTENT_ROOTS if the collection moved; ` +
					`the guard must not pass without validating content.`,
			);
		}
		continue;
	}

	const files = listJsonFiles(dirPath);
	if (required && files.length === 0) {
		errors.push(
			`${repoDir} contains no JSON files. Update CONTENT_ROOTS if the collection moved; ` +
				`the guard must not pass without validating content.`,
		);
		continue;
	}

	for (const file of files) {
		checkedFiles++;
		const repoFile = toRepoPath(file);
		let parsed;
		try {
			parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
		} catch (error) {
			errors.push(`${repoFile} is not valid JSON and cannot be verified (${error.message}).`);
			continue;
		}
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			errors.push(`${repoFile} is not a JSON object and cannot be verified.`);
			continue;
		}

		if (parsed.isDemo !== true) {
			errors.push(
				`${repoFile} is not marked isDemo=true. ` +
					`Real client data must not live in content collections. ` +
					`Use the intake pipeline (intake -> draft -> publish -> DB).`,
			);
		}

		const profileId = parsed.visualProfileId;
		if (typeof profileId === 'string' && !profileId.startsWith(DEMO_PROFILE_PREFIX)) {
			clientProfileDemos.push({ repoFile, slug: path.basename(file, '.json'), profileId });
		}
	}
}

if (clientProfileDemos.length > 0) {
	const showroomItems = loadShowroomItems();
	if (!showroomItems) {
		errors.push(
			`Cannot read ${SHOWROOM_ITEMS_EXPORT} from ${SHOWROOM_DATA_FILE}; demos that reuse ` +
				`a client visual profile cannot be verified.`,
		);
	} else {
		for (const { repoFile, slug, profileId } of clientProfileDemos) {
			const item = showroomItems.get(slug);
			if (
				item?.visibility === QUARANTINE.visibility &&
				item?.reviewStatus === QUARANTINE.reviewStatus
			) {
				continue;
			}
			const state = item
				? `visibility=${item.visibility ?? 'unknown'}, reviewStatus=${item.reviewStatus ?? 'unknown'}`
				: 'missing';
			errors.push(
				`${repoFile} reuses client visual profile "${profileId}" but its showroom entry ` +
					`"${slug}" is ${state}. Keep it visibility='${QUARANTINE.visibility}' and ` +
					`reviewStatus='${QUARANTINE.reviewStatus}' in ${SHOWROOM_DATA_FILE}, or switch ` +
					`to a demo-owned profile ("${DEMO_PROFILE_PREFIX}*").`,
			);
		}
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(`[PII] ${error}`);
	process.exit(1);
}

console.log(
	`PII guardrail: checked ${checkedFiles} content files; all are demo fixtures` +
		(clientProfileDemos.length > 0
			? `; ${clientProfileDemos.length} demo(s) reusing client visual profiles are ` +
				`quarantined (${QUARANTINE.visibility}/${QUARANTINE.reviewStatus}).`
			: '.'),
);
