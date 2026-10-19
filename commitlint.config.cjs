const FORBIDDEN_VOCABULARY =
	/\b(wip|fix stuff|misc|various|tmp|temp|quick fix|minor changes|small fix|tweaks|improvements|adjustments|stuff|things)\b/i;

const SUBJECT_PROCESS_LANGUAGE =
	/\b(?:record|scope|apply changes|process(?!\.)|misc|tmp|temp|things|stuff)\b/i;

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

// AGENTS.md (Technical Commit Messages) forbids internal process identifiers anywhere in the
// message. A process word followed by a number is unambiguous, so it blocks the commit.
const PROCESS_IDENTIFIERS = /\b(?:goal|phase|sprint|wave|milestone)\s*#?\d+(?:\.\d+)?\b/i;

// Plan step and decision codes such as D5, F7, G0-G7, Q12 or T0. Product names share the shape
// (Cloudflare D1), so this rule only warns.
const PLAN_CODES = /\b[DFGQT]\d{1,2}[a-z]?\b/;

// Canonical scopes, defined in docs/core/git-governance.md (Scopes). Unknown scopes warn.
const SCOPES = [
	'agent',
	'auth',
	'ci',
	'commercial',
	'content',
	'dashboard',
	'db',
	'demos',
	'deps',
	'deps-dev',
	'engagement',
	'env',
	'git',
	'governance',
	'guests',
	'hosting',
	'images',
	'intake',
	'invitation',
	'invitation-access',
	'invitation-preparation',
	'landing',
	'memories',
	'ops',
	'plans',
	'provisioning',
	'release',
	'rsvp',
	'runtime',
	'security',
	'seo',
	'testing',
	'theme',
	'tooling',
	'tracking',
	'validation',
	'visual',
	'workers',
];

const fullMessage = (parsed) =>
	[parsed.header, parsed.body, parsed.footer].filter(Boolean).join('\n');

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
		'scope-enum': [1, 'always', SCOPES],
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 100],
		'body-leading-blank': [2, 'always'],
		'body-max-line-length': [2, 'always', 100],
		'no-forbidden-vocabulary': [2, 'always'],
		'subject-target-required': [2, 'always'],
		'no-process-language': [2, 'always'],
		'no-process-identifiers': [2, 'always'],
		'no-plan-codes': [1, 'always'],
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
				'no-process-identifiers': (parsed) => {
					const match = fullMessage(parsed).match(PROCESS_IDENTIFIERS);
					if (!match) return [true];
					return [
						false,
						`commit message names an internal process identifier: "${match[0]}"`,
					];
				},
				'no-plan-codes': (parsed) => {
					const match = fullMessage(parsed).match(PLAN_CODES);
					if (!match) return [true];
					return [
						false,
						`commit message contains the plan code "${match[0]}"; describe the change it stands for`,
					];
				},
			},
		},
	],
};
