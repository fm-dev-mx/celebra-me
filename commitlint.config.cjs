const FORBIDDEN_VOCABULARY =
	/\b(wip|fix stuff|misc|various|tmp|temp|quick fix|minor changes|small fix|tweaks|improvements|adjustments|stuff|things)\b/i;

const SUBJECT_PROCESS_LANGUAGE =
	/\b(record|scope|apply changes|process|misc|tmp|temp|things|stuff)\b/i;

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
		'scope-case': [2, 'always', 'kebab-case'],
		'scope-empty': [2, 'never'],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 130],
		'body-leading-blank': [2, 'always'],
		'body-max-line-length': [2, 'always', 140],
		'no-forbidden-vocabulary': [2, 'always'],
		'subject-target-required': [2, 'always'],
		'no-process-language': [2, 'always'],
	},
	plugins: [
		{
			rules: {
				'no-forbidden-vocabulary': (parsed) => {
					const match = `${parsed.subject || ''}\n${parsed.body || ''}`.match(
						FORBIDDEN_VOCABULARY,
					);
					if (!match) return [true];
					return [false, `commit message contains forbidden vocabulary: "${match[0]}"`];
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
				'no-process-language': (parsed) => {
					if (SUBJECT_PROCESS_LANGUAGE.test(parsed.subject || '')) {
						return [false, 'subject must describe the change'];
					}
					return [true];
				},
			},
		},
	],
};
