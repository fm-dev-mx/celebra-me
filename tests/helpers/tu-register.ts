/**
 * Informal "tú" forms that must not appear in visitor-facing copy (visible UI uses "usted").
 * Ambiguous forms shared with the "usted" present tense are intentionally not listed.
 */
export const TU_FORMS = [
	'tú',
	'tu',
	'tus',
	'te',
	'ti',
	'contigo',
	'invitarte',
	'puedes',
	'quieres',
	'sabes',
	'tienes',
	'necesitas',
	'estás',
	'recibes',
	'prefieres',
	'compartes',
	'envías',
	'agregas',
	'eliges',
	'elige',
	'cuéntanos',
	'déjanos',
	'escríbenos',
	'contáctanos',
];

/** Word boundaries that also treat accented letters as word characters. */
export const tuFormPattern = new RegExp(
	`(?<![\\p{L}\\p{N}_])(${TU_FORMS.join('|')})(?![\\p{L}\\p{N}_])`,
	'iu',
);
