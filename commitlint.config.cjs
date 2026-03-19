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

function trailerBlob(parsed) {
	return [parsed.body || '', parsed.footer || '', parsed.raw || ''].filter(Boolean).join('\n');
}

function trailerValue(parsed, key) {
	const blob = trailerBlob(parsed);
	const match = blob.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
	return match ? match[1].trim() : '';
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
		'body-path-coverage': [2, 'always'],
		'no-ellipsis-in-body': [2, 'always'],
		'planned-trailers-required': [2, 'always'],
		'planned-trailers-match-context': [2, 'always'],
		'planned-scope-matches-domain': [2, 'always'],
		'subject-matches-unit': [2, 'always'],
		'unit-file-coverage': [2, 'always'],
		'unit-no-extra-files': [2, 'always'],
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
				'body-path-coverage': (parsed) => {
					const stagedFiles = (process.env.COMMITLINT_STAGED_FILES || '')
						.split('\n')
						.filter(Boolean);
					const body = parsed.body || '';
					const missing = stagedFiles.filter((file) => !body.includes(file));
					if (!missing.length) return [true];
					return [
						false,
						`commit body bullets must use exact changed file path (missing: ${missing.join(', ')})`,
					];
				},
				'no-ellipsis-in-body': (parsed) => {
					if ((parsed.body || '').includes('...')) {
						return [false, 'ellipsis (...) is not allowed in commit body path bullets'];
					}
					return [true];
				},
				'planned-trailers-required': (parsed) => {
					const planId = trailerValue(parsed, 'Plan-Id');
					const unitId = trailerValue(parsed, 'Commit-Unit');
					if (!planId || !unitId) {
						return [
							false,
							'planned commits must include Plan-Id and Commit-Unit trailers',
						];
					}
					return [true];
				},
				'planned-trailers-match-context': (parsed) => {
					const expectedPlanId = String(process.env.COMMITLINT_PLAN_ID || '').trim();
					const expectedUnitId = String(process.env.COMMITLINT_UNIT_ID || '').trim();
					const actualPlanId = trailerValue(parsed, 'Plan-Id');
					const actualUnitId = trailerValue(parsed, 'Commit-Unit');
					if (expectedPlanId && actualPlanId !== expectedPlanId) {
						return [false, `Plan-Id trailer must match "${expectedPlanId}"`];
					}
					if (expectedUnitId && actualUnitId !== expectedUnitId) {
						return [false, `Commit-Unit trailer must match "${expectedUnitId}"`];
					}
					return [true];
				},
				'planned-scope-matches-domain': (parsed) => {
					const expectedDomain = String(process.env.COMMITLINT_UNIT_DOMAIN || '').trim();
					if (!expectedDomain) return [true];
					return [
						String(parsed.scope || '').trim() === expectedDomain,
						`scope must match planned unit domain "${expectedDomain}"`,
					];
				},
				'subject-matches-unit': (parsed) => {
					const verb = String(process.env.COMMITLINT_UNIT_VERB || '')
						.trim()
						.toLowerCase();
					const target = String(process.env.COMMITLINT_UNIT_TARGET || '')
						.trim()
						.toLowerCase();
					if (!verb || !target) return [true];
					const expected = `${verb} ${target}`.trim();
					const actual = String(parsed.subject || '')
						.trim()
						.toLowerCase();
					return [
						actual === expected,
						`subject must match planned commit unit subject "${expected}"`,
					];
				},
				'unit-file-coverage': (parsed) => {
					const expectedFiles = JSON.parse(
						process.env.COMMITLINT_UNIT_FILES_JSON || '[]',
					);
					if (!Array.isArray(expectedFiles) || expectedFiles.length === 0) return [true];
					const body = parsed.body || '';
					const missing = expectedFiles.filter((file) => !body.includes(file));
					if (!missing.length) return [true];
					return [
						false,
						`commit body must cover every planned unit file (missing: ${missing.join(', ')})`,
					];
				},
				'unit-no-extra-files': () => {
					const expectedFiles = JSON.parse(
						process.env.COMMITLINT_UNIT_FILES_JSON || '[]',
					);
					if (!Array.isArray(expectedFiles) || expectedFiles.length === 0) return [true];
					const stagedFiles = (process.env.COMMITLINT_STAGED_FILES || '')
						.split('\n')
						.filter(Boolean);
					const extras = stagedFiles.filter((file) => !expectedFiles.includes(file));
					if (!extras.length) return [true];
					return [
						false,
						`staged files exceed the selected commit unit (extra: ${extras.join(', ')})`,
					];
				},
			},
		},
	],
};
