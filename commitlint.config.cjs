const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const domainMapPath = path.resolve(__dirname, '.agent/governance/config/domain-map.json');
let validScopes = [];
try {
	const domainMapContent = fs.readFileSync(domainMapPath, 'utf8');
	const domainMap = JSON.parse(domainMapContent);
	validScopes = Object.keys(domainMap.domains || {});
} catch (error) {
	console.error('Failed to load domain-map.json for commitlint scopes:', error);
	validScopes = [
		'core',
		'ui',
		'invitation',
		'auth',
		'theme',
		'governance',
		'docs',
		'test',
		'admin',
	];
}

const FORBIDDEN_VOCABULARY =
	/\b(wip|fix stuff|misc|various|tmp|temp|quick fix|minor changes|small fix|tweaks|improvements|adjustments|stuff|things)\b/i;
const SUBJECT_PROCESS_LANGUAGE =
	/\b(record|scope|apply changes|process|misc|tmp|temp|things|stuff)\b/i;
const SPANISH_HINT =
	/\b(el|la|los|las|para|con|sin|por|que|como|cuando|donde|arreglo|cambio)\b|[áéíóúñ]/i;
const STRONG_VERBS = new Set([
	'add',
	'align',
	'allow',
	'archive',
	'clarify',
	'configure',
	'consolidate',
	'deprecate',
	'document',
	'drop',
	'expand',
	'extract',
	'extend',
	'finalize',
	'fix',
	'formalize',
	'harden',
	'implement',
	'improve',
	'include',
	'introduce',
	'migrate',
	'modularize',
	'move',
	'narrow',
	'refactor',
	'refine',
	'register',
	'remove',
	'rename',
	'replace',
	'restore',
	'split',
	'standardize',
	'sync',
	'synchronize',
	'update',
]);
const GENERIC_TARGETS = new Set([
	'change',
	'changes',
	'file',
	'files',
	'message',
	'messages',
	'scope',
	'scopes',
	'stuff',
	'things',
	'work',
]);
const GENERIC_DESCRIPTION =
	/\b(update files|update file|misc|things|stuff|various changes|minor changes)\b/i;
const MIN_BODY_LENGTH = 30;

function parseFileList(raw) {
	return String(raw || '')
		.split(/\r?\n|,/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseJsonEnv(name, fallback) {
	try {
		const raw = process.env[name];
		if (!raw) return fallback;
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function normalizePath(value) {
	return String(value || '')
		.replace(/\\/g, '/')
		.trim();
}

function classifyAreaFromPath(file) {
	const normalized = normalizePath(file).toLowerCase();
	if (!normalized) return 'source';
	if (
		normalized.startsWith('docs/') ||
		normalized.endsWith('.md') ||
		normalized.endsWith('.mdx')
	) {
		return 'docs';
	}
	if (
		normalized.startsWith('tests/') ||
		normalized.includes('.test.') ||
		normalized.includes('.spec.')
	) {
		return 'test';
	}
	if (
		normalized.startsWith('src/assets/') ||
		/\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(normalized)
	) {
		return 'asset';
	}
	if (
		normalized.startsWith('scripts/') ||
		normalized.startsWith('.agent/') ||
		normalized.endsWith('.mjs') ||
		normalized.endsWith('.sh')
	) {
		return 'script';
	}
	if (
		normalized.endsWith('.json') ||
		normalized.endsWith('.yml') ||
		normalized.endsWith('.yaml') ||
		normalized.endsWith('.toml') ||
		normalized.endsWith('.ini') ||
		normalized.endsWith('.cjs')
	) {
		return 'config';
	}
	return 'source';
}

function getCommitFiles() {
	const fromEnv = parseFileList(process.env.COMMITLINT_STAGED_FILES).map(normalizePath);
	if (fromEnv.length) return fromEnv;
	try {
		const stdout = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=d'], {
			cwd: __dirname,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		return parseFileList(stdout).map(normalizePath);
	} catch {
		return [];
	}
}

function getDiffEntries() {
	const fromEnv = parseJsonEnv('COMMITLINT_DIFF_JSON', null);
	if (Array.isArray(fromEnv) && fromEnv.length) {
		return fromEnv.map((entry) => ({
			path: normalizePath(entry.path),
			status: String(entry.status || 'M').toUpperCase(),
			area: entry.area || classifyAreaFromPath(entry.path),
		}));
	}
	return getCommitFiles().map((file) => ({
		path: file,
		status: 'M',
		area: classifyAreaFromPath(file),
	}));
}

function getDominantChangeKind() {
	return String(process.env.COMMITLINT_DOMINANT_CHANGE_KIND || 'mixed')
		.trim()
		.toLowerCase();
}

function getDominantArea() {
	return String(process.env.COMMITLINT_DOMINANT_AREA || 'mixed')
		.trim()
		.toLowerCase();
}

function isComplex(parsed) {
	const subject = parsed.subject || '';
	const files = getCommitFiles();
	const diffEntries = getDiffEntries();
	const areaCount = new Set(diffEntries.map((entry) => entry.area)).size;
	const dirCount = new Set(
		files
			.map((file) => normalizePath(path.posix.dirname(file)))
			.filter((dir) => dir && dir !== '.'),
	).size;
	return (
		subject.length >= 50 ||
		/\b(and|with|plus)\b/i.test(subject) ||
		files.length > 1 ||
		areaCount > 1 ||
		dirCount > 1
	);
}

function bodyRequired(parsed) {
	return isComplex(parsed) || getCommitFiles().length > 1;
}

function getBulletLines(body) {
	return String(body || '')
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

function parseBullet(line) {
	const match = line.match(/^-?\s*([^:]+):\s+(.+)$/);
	if (!match) return null;
	return {
		pathSpec: normalizePath(match[1]),
		description: match[2].trim(),
	};
}

function isPathSpec(value) {
	return /^(?:[\w./[\]-]+(?:\/\*\*|\/)?|[\w./[\]-]+\.[\w-]+)$/.test(value);
}

function matchPathSpec(file, pathSpec) {
	const normalizedFile = normalizePath(file);
	const normalizedSpec = normalizePath(pathSpec);
	if (normalizedSpec.endsWith('/**')) {
		const prefix = normalizedSpec.slice(0, -3);
		return normalizedFile.startsWith(prefix);
	}
	if (normalizedSpec.endsWith('/')) {
		return normalizedFile.startsWith(normalizedSpec);
	}
	return normalizedFile === normalizedSpec;
}

function getCoveredFiles(pathSpec, commitFiles) {
	return commitFiles.filter((file) => matchPathSpec(file, pathSpec));
}

function getSubjectVerb(subject) {
	const normalized = String(subject || '')
		.trim()
		.toLowerCase();
	const [verb] = normalized.split(/\s+/, 1);
	return verb || '';
}

function forbiddenVerbsForKind(kind) {
	switch (kind) {
		case 'add':
			return new Set(['drop', 'remove']);
		case 'delete':
			return new Set(['add', 'introduce', 'implement', 'register']);
		case 'rename':
			return new Set(['add', 'drop', 'remove']);
		default:
			return null;
	}
}

module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [
			2,
			'always',
			[
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'perf',
				'test',
				'build',
				'ci',
				'chore',
				'revert',
			],
		],
		'type-case': [2, 'always', 'lower-case'],
		'scope-enum': [2, 'always', validScopes],
		'scope-case': [2, 'always', 'kebab-case'],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 72],
		'body-leading-blank': [2, 'always'],
		'no-forbidden-vocabulary': [2, 'always'],
		'english-message': [2, 'always'],
		'body-required-for-multi-file': [2, 'always'],
		'body-bullets-for-complex': [2, 'always'],
		'body-min-length-when-required': [2, 'always'],
		'body-file-path-bullets': [2, 'always'],
		'body-no-ellipsis-paths': [2, 'always'],
		'subject-strong-verb': [2, 'always'],
		'subject-no-process-language': [2, 'always'],
		'subject-target-required': [2, 'always'],
		'subject-dominant-change-match': [2, 'always'],
		'body-bullet-description-quality': [2, 'always'],
		'body-bullet-group-coverage': [2, 'always'],
	},
	plugins: [
		{
			rules: {
				'no-forbidden-vocabulary': (parsed) => {
					const subject = parsed.subject || '';
					const body = parsed.body || '';
					const combined = `${subject}\n${body}`;
					const match = combined.match(FORBIDDEN_VOCABULARY);
					if (match) {
						return [
							false,
							`commit message contains forbidden vocabulary: "${match[0]}"`,
						];
					}
					return [true];
				},
				'english-message': (parsed) => {
					const full = [parsed.header, parsed.body, parsed.footer]
						.filter(Boolean)
						.join('\n');
					return [!SPANISH_HINT.test(full), 'commit message must be written in English'];
				},
				'body-required-for-multi-file': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const body = (parsed.body || '').trim();
					return [
						Boolean(body),
						'multi-file or complex commits require a descriptive body',
					];
				},
				'body-bullets-for-complex': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const bodyLines = getBulletLines(parsed.body);
					if (bodyLines.length === 0) {
						return [false, 'complex or multi-file commits require bullet-point bodies'];
					}
					const allBullets = bodyLines.every((line) => /^-\s+\S+/.test(line));
					return [
						allBullets,
						'complex or multi-file commit bodies must use concise "- ..." bullets',
					];
				},
				'body-min-length-when-required': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const body = (parsed.body || '').trim();
					if (body.length < MIN_BODY_LENGTH) {
						return [
							false,
							`body must be at least ${MIN_BODY_LENGTH} characters when required (got ${body.length})`,
						];
					}
					return [true];
				},
				'body-file-path-bullets': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const commitFiles = getCommitFiles();
					const bulletLines = getBulletLines(parsed.body);
					if (bulletLines.length === 0) {
						return [false, 'required bodies must include file-path bullets'];
					}
					const bullets = bulletLines.map(parseBullet);
					if (bullets.some((bullet) => !bullet)) {
						return [
							false,
							'commit body bullets must use "- relative/path.ext: description" format',
						];
					}
					const invalidSpec = bullets.find((bullet) => !isPathSpec(bullet.pathSpec));
					if (invalidSpec) {
						return [
							false,
							`commit body bullet path must be a file or folder path: "${invalidSpec.pathSpec}"`,
						];
					}
					const unmatched = bullets.find(
						(bullet) => getCoveredFiles(bullet.pathSpec, commitFiles).length === 0,
					);
					if (unmatched) {
						return [
							false,
							`commit body bullet path does not match any changed file: "${unmatched.pathSpec}"`,
						];
					}
					return [true];
				},
				'body-no-ellipsis-paths': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const bulletLines = getBulletLines(parsed.body);
					const bullets = bulletLines.map(parseBullet).filter(Boolean);
					const invalid = bullets.find((bullet) => bullet.pathSpec.includes('...'));
					if (!invalid) return [true];
					return [
						false,
						'commit body bullet paths must use full relative paths; ellipsis (...) is not allowed',
					];
				},
				'subject-strong-verb': (parsed) => {
					const verb = getSubjectVerb(parsed.subject);
					return [
						STRONG_VERBS.has(verb),
						'subject must start with a strong verb after type(scope):',
					];
				},
				'subject-no-process-language': (parsed) => {
					const subject = parsed.subject || '';
					return [
						!SUBJECT_PROCESS_LANGUAGE.test(subject),
						'subject must describe the change, not the process or scope bookkeeping',
					];
				},
				'subject-target-required': (parsed) => {
					const subject = String(parsed.subject || '').trim();
					const [verb, ...targetWords] = subject
						.toLowerCase()
						.split(/\s+/)
						.filter(Boolean);
					if (!verb) return [false, 'subject must include a verb and target'];
					if (targetWords.length < 2) {
						return [false, 'subject must include a concrete target after the verb'];
					}
					const meaningfulWords = targetWords.filter(
						(word) => !GENERIC_TARGETS.has(word),
					);
					return [
						meaningfulWords.length > 0,
						'subject target is too generic; name the concrete thing that changed',
					];
				},
				'subject-dominant-change-match': (parsed) => {
					const verb = getSubjectVerb(parsed.subject);
					const commitType = String(parsed.type || '').toLowerCase();
					const dominantKind = getDominantChangeKind();
					const forbiddenByKind = forbiddenVerbsForKind(dominantKind);
					if (forbiddenByKind && forbiddenByKind.has(verb)) {
						return [
							false,
							`subject verb "${verb}" does not match dominant ${dominantKind} changes`,
						];
					}
					if (getDominantArea() === 'test' && commitType === 'feat') {
						return [false, 'test-dominant commits should not use the feat type'];
					}
					return [true];
				},
				'body-bullet-description-quality': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const bulletLines = getBulletLines(parsed.body);
					const bullets = bulletLines.map(parseBullet).filter(Boolean);
					const invalid = bullets.find((bullet) => {
						const words = bullet.description.toLowerCase().split(/\s+/).filter(Boolean);
						return (
							words.length < 2 ||
							GENERIC_DESCRIPTION.test(bullet.description) ||
							normalizePath(bullet.description).startsWith(bullet.pathSpec)
						);
					});
					if (!invalid) return [true];
					return [
						false,
						`commit body bullet description must be concise, specific, and action-led: "${invalid.description}"`,
					];
				},
				'body-bullet-group-coverage': (parsed) => {
					if (!bodyRequired(parsed)) return [true];
					const commitFiles = getCommitFiles();
					const bullets = getBulletLines(parsed.body).map(parseBullet).filter(Boolean);
					const covered = new Set();
					for (const bullet of bullets) {
						for (const file of getCoveredFiles(bullet.pathSpec, commitFiles)) {
							covered.add(file);
						}
					}
					const missing = commitFiles.filter((file) => !covered.has(file));
					if (missing.length) {
						return [
							false,
							`commit body must cover every changed file or file group (missing ${missing[0]})`,
						];
					}
					return [true];
				},
			},
		},
	],
};
