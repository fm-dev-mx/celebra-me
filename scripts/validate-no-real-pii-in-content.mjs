#!/usr/bin/env node
/**
 * PII guardrail for static content collections.
 *
 * Real client data must live in the database (intake -> draft -> publish), never in
 * `src/content/**`. The guard fails closed: a required content root that is missing or holds no
 * JSON files is an error, so a moved or restructured collection cannot turn it into a no-op.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Demo showroom collection, loaded recursively (`src/content/event-demos/<eventType>/*.json`).
const CONTENT_ROOT = 'event-demos';
// Demo-owned visual profiles carry this prefix; any other profile id belongs to a real client.
const DEMO_PROFILE_PREFIX = 'demo-';

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

const errors = [];
let checkedFiles = 0;

const dirPath = path.join(PROJECT_ROOT, 'src', 'content', CONTENT_ROOT);
const repoDir = toRepoPath(dirPath);
const files = fs.existsSync(dirPath) ? listJsonFiles(dirPath) : null;

if (files === null) {
	errors.push(
		`${repoDir} is missing. Update CONTENT_ROOT if the collection moved; ` +
			`the guard must not pass without validating content.`,
	);
} else if (files.length === 0) {
	errors.push(
		`${repoDir} contains no JSON files. Update CONTENT_ROOT if the collection moved; ` +
			`the guard must not pass without validating content.`,
	);
}

for (const file of files ?? []) {
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
		errors.push(
			`${repoFile} uses client visual profile "${profileId}". A client profile is a ` +
				`delivered artifact and must not style a demo; use a demo-owned profile ` +
				`("${DEMO_PROFILE_PREFIX}*").`,
		);
	}
}

// Demo photographs must not be byte copies of client photographs. Owner-approved reuse is listed
// by client asset folder; see "Photographs shared with demos" in docs/core/sensitive-data-guide.md.
const EVENT_ASSET_ROOT = path.join(PROJECT_ROOT, 'src', 'assets', 'images', 'events');
const CLIENT_ASSET_ROOTS = [
	EVENT_ASSET_ROOT,
	path.join(PROJECT_ROOT, 'src', 'assets', 'invitations'),
];
const APPROVED_SHARED_CLIENT_FOLDERS = new Set();
const IMAGE_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);

function listImages(dirPath) {
	if (!fs.existsSync(dirPath)) return [];
	return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(dirPath, entry.name);
		if (entry.isDirectory()) return listImages(target);
		return IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
	});
}

function listFolders(dirPath) {
	if (!fs.existsSync(dirPath)) return [];
	return fs
		.readdirSync(dirPath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const demoImagesByDigest = new Map();
for (const folder of listFolders(EVENT_ASSET_ROOT).filter((name) =>
	name.startsWith(DEMO_PROFILE_PREFIX),
)) {
	for (const image of listImages(path.join(EVENT_ASSET_ROOT, folder))) {
		demoImagesByDigest.set(digest(image), toRepoPath(image));
	}
}

for (const root of CLIENT_ASSET_ROOTS) {
	for (const folder of listFolders(root).filter(
		(name) => !name.startsWith(DEMO_PROFILE_PREFIX),
	)) {
		if (APPROVED_SHARED_CLIENT_FOLDERS.has(folder)) continue;
		for (const image of listImages(path.join(root, folder))) {
			const demoImage = demoImagesByDigest.get(digest(image));
			if (demoImage) {
				errors.push(
					`${demoImage} is a byte copy of client photograph ${toRepoPath(image)}. ` +
						`Demos use fictitious or owner-approved images only.`,
				);
			}
		}
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(`[PII] ${error}`);
	process.exit(1);
}

console.log(`PII guardrail: checked ${checkedFiles} content files; all are demo fixtures.`);
