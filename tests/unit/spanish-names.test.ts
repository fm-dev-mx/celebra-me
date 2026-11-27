import { joinSpanishNames } from '@/lib/invitation/spanish-names';

describe('joinSpanishNames', () => {
	it.each([
		['Adriana', 'Israel', 'Adriana e Israel'],
		['Luis', 'Íngrid', 'Luis e Íngrid'],
		['Ana', 'Hilario', 'Ana e Hilario'],
		['Daniela', 'David', 'Daniela y David'],
		['Olivia', 'Yolanda', 'Olivia y Yolanda'],
		['Ana', 'Hiedra', 'Ana y Hiedra'],
	])('joins %s and %s as %s', (first, second, expected) => {
		expect(joinSpanishNames(first, second)).toBe(expected);
	});
});
