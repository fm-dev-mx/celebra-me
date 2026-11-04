import {
	MEXICAN_CITIES,
	canonicalizeMexicanCity,
	findMexicanCity,
	mexicanCityKey,
} from '@/lib/commercial/mexican-cities';

describe('mexican cities', () => {
	it.each([
		['Cd. Juárez', 'Ciudad Juárez'],
		['cd juarez', 'Ciudad Juárez'],
		['JUAREZ', 'Ciudad Juárez'],
		['CDJ', 'Ciudad Juárez'],
		['Juárez, Chih.', 'Ciudad Juárez'],
		['cdmx', 'Ciudad de México'],
		['México D.F.', 'Ciudad de México'],
		['  los   mochis ', 'Los Mochis'],
		['Los Mochis, Sinaloa', 'Los Mochis'],
		['mty', 'Monterrey'],
	])('maps «%s» to «%s»', (typed, canonical) => {
		expect(canonicalizeMexicanCity(typed)).toBe(canonical);
	});

	it('keeps an unlisted city as typed, with spaces collapsed', () => {
		expect(canonicalizeMexicanCity('  Villa   Ahumada ')).toBe('Villa Ahumada');
		expect(findMexicanCity('Villa Ahumada')).toBeUndefined();
		expect(canonicalizeMexicanCity('   ')).toBeUndefined();
		expect(canonicalizeMexicanCity(null)).toBeUndefined();
	});

	it('has one city per name and alias', () => {
		const keys = MEXICAN_CITIES.flatMap((city) =>
			[city.name, ...(city.aliases ?? [])].map(mexicanCityKey),
		);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
