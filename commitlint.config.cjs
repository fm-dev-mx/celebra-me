const VAGUE_SUBJECT = /\b(wip|update|fix stuff|changes|misc|various|tmp|temp|quick fix)\b/i;
const SPANISH_HINT =
	/\b(el|la|los|las|para|con|sin|por|que|como|cuando|donde|arreglo|cambio)\b|[áéíóúñ]/i;

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
		'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 72],
		'body-leading-blank': [2, 'always'],
		'no-vague-subject': [2, 'always'],
		'english-message': [2, 'always'],
		'body-bullets-for-complex': [2, 'always'],
	},
	plugins: [
		{
			rules: {
				'no-vague-subject': (parsed) => {
					const subject = parsed.subject || '';
					return [!VAGUE_SUBJECT.test(subject), 'commit subject is too vague'];
				},
				'english-message': (parsed) => {
					const full = [parsed.header, parsed.body, parsed.footer]
						.filter(Boolean)
						.join('\n');
					return [!SPANISH_HINT.test(full), 'commit message must be written in English'];
				},
				'body-bullets-for-complex': (parsed) => {
					const subject = parsed.subject || '';
					const body = (parsed.body || '').trim();
					const isComplex = subject.length >= 50 || /\b(and|with|plus)\b/i.test(subject);
					if (!isComplex) return [true];
					if (!body) return [false, 'complex commits require a body with bullet points'];
					const bodyLines = body.split(/\r?\n/).filter(Boolean);
					const allBullets = bodyLines.every((line) => /^-\s+\S+/.test(line));
					return [allBullets, 'complex commit bodies must use concise "- ..." bullets'];
				},
			},
		},
	],
};
