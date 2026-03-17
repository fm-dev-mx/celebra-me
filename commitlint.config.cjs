const fs = require('fs');
const path = require('path');

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
		'body-max-line-length': [2, 'always', 140],
		'scope-enum': [2, 'always', validScopes],
		'scope-case': [2, 'always', 'kebab-case'],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 130],
		'body-leading-blank': [2, 'always'],
		'no-forbidden-vocabulary': [2, 'always'],
		'subject-target-required': [2, 'always'],
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
				'subject-target-required': (parsed) => {
					const subject = String(parsed.subject || '').trim();
					const [verb, ...targetWords] = subject
						.toLowerCase()
						.split(/\s+/)
						.filter(Boolean);
					if (!verb) return [false, 'subject must include a verb and target'];
					if (targetWords.length < 2) {
						if (parsed.scope && parsed.scope.length > 30) return [true];
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
			},
		},
	],
};
