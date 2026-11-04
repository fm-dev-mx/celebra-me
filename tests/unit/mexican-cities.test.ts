import {
	MEXICAN_CITIES,
	MEXICAN_STATES,
	canonicalizeMexicanCity,
	findMexicanCity,
	findMexicanState,
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

	it.each([
		['Guadalupe', 'Nuevo León'],
		['Guadalupe, Zac.', 'Zacatecas'],
		['Guadalupe, Zacatecas', 'Zacatecas'],
		['Guadalupe, Nuevo León', 'Nuevo León'],
		['Juárez, Nuevo León', 'Nuevo León'],
		['Saltillo, Coahuila de Zaragoza', 'Coahuila'],
		['Ojo de Agua', 'Estado de México'],
	])('reads «%s» as a city in %s', (typed, state) => {
		expect(findMexicanCity(typed)?.state).toBe(state);
	});

	it('maps INEGI official names to the common name', () => {
		expect(canonicalizeMexicanCity('Heroica Puebla de Zaragoza')).toBe('Puebla');
		expect(canonicalizeMexicanCity('Xalapa-Enríquez')).toBe('Xalapa');
		expect(canonicalizeMexicanCity('Iztapalapa')).toBe('Ciudad de México');
	});

	it('reads states by common name, INEGI name or abbreviation', () => {
		expect(findMexicanState('Edo. de México')?.official).toBe('México');
		expect(findMexicanState('Michoacán de Ocampo')?.name).toBe('Michoacán');
		expect(findMexicanState('Q. Roo')?.name).toBe('Quintana Roo');
		expect(MEXICAN_STATES).toHaveLength(32);
	});

	it('lists each city once per state, in a listed state', () => {
		const states = new Set(MEXICAN_STATES.map((state) => state.name));
		const keys = MEXICAN_CITIES.flatMap((city) => {
			expect(states.has(city.state)).toBe(true);
			return [city.name, ...(city.aliases ?? [])].map(
				(label) => `${city.state}:${mexicanCityKey(label)}`,
			);
		});
		expect(new Set(keys).size).toBe(keys.length);
		expect(new Set(MEXICAN_CITIES.map((city) => city.state)).size).toBe(32);
	});
});
