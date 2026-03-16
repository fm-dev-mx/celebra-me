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
	/\b(wip|update|fix stuff|changes|misc|various|tmp|temp|quick fix|refactor scripts|minor changes|small fix|cleanup|tweaks|improvements|adjustments|stuff|things)\b/i;
const SPANISH_HINT =
	/\b(el|la|los|las|para|con|sin|por|que|como|cuando|donde|arreglo|cambio)\b|[áéíóúñ]/i;
const MIN_BODY_LENGTH = 30;

function parseFileList(raw) {
	return String(raw || '')
		.split(/\r?\n|,/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function getCommitFiles() {
	const fromEnv = parseFileList(process.env.COMMITLINT_STAGED_FILES);
	if (fromEnv.length) return fromEnv;
	try {
		const stdout = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=d'], {
			cwd: __dirname,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		return parseFileList(stdout);
	} catch {
		return [];
	}
}

function isComplex(parsed) {
	const subject = parsed.subject || '';
	return subject.length >= 50 || /\b(and|with|plus)\b/i.test(subject);
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

function isFilePathBullet(line) {
	return /^-\s+[\w./[\]-]+:\s+\S+/.test(line);
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
					const allFilePathBullets = bulletLines.every(isFilePathBullet);
					if (!allFilePathBullets) {
						return [
							false,
							'commit body bullets must use "- relative/path.ext: description" format',
						];
					}
					if (commitFiles.length > 1 && bulletLines.length < commitFiles.length) {
						return [
							false,
							`commit body must document each staged file with a bullet (expected ${commitFiles.length}, got ${bulletLines.length})`,
						];
					}
					return [true];
				},
			},
		},
	],
};
