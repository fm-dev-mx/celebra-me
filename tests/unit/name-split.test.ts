import { splitLeadWords } from '@/lib/invitation/name-split';

describe('splitLeadWords', () => {
	const name = 'Naydelin Pauleth Paredes Martinez';

	it('leaves the name whole when no split is requested', () => {
		expect(splitLeadWords(name)).toBeUndefined();
		expect(splitLeadWords(name, 0)).toBeUndefined();
	});

	it('returns undefined when name is falsy, non-string, or empty', () => {
		expect(splitLeadWords(undefined, 1)).toBeUndefined();
		expect(splitLeadWords(null, 1)).toBeUndefined();
		expect(splitLeadWords('', 1)).toBeUndefined();
		expect(splitLeadWords('   ', 1)).toBeUndefined();
	});

	it('leaves the name whole when the lead would take every word', () => {
		expect(splitLeadWords(name, 4)).toBeUndefined();
		expect(splitLeadWords('Naydelin', 1)).toBeUndefined();
	});

	it('splits the leading words from the remainder', () => {
		expect(splitLeadWords(name, 1)).toEqual({
			lead: 'Naydelin',
			rest: 'Pauleth Paredes Martinez',
		});
		expect(splitLeadWords(name, 2)).toEqual({
			lead: 'Naydelin Pauleth',
			rest: 'Paredes Martinez',
		});
	});

	it('collapses surrounding and repeated whitespace', () => {
		expect(splitLeadWords('  Ana   Sofía  Cota ', 2)).toEqual({
			lead: 'Ana Sofía',
			rest: 'Cota',
		});
	});
});
