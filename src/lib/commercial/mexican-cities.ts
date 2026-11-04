/**
 * Canonical Mexican cities for the «Aparta su fecha» city field.
 *
 * The form offers these names as suggestions; whatever the visitor types is matched against the
 * names and aliases («Cd. Juárez», «Juarez», «CDJ» → «Ciudad Juárez») so the customer record and
 * the hashed Meta `ct`/`st` keys get one spelling per city. A city outside the list is kept as
 * typed. Client-safe: plain data, no server imports.
 *
 * Source: INEGI, Censo de Población y Vivienda 2020 (Catálogo Único de Claves Geoestadísticas).
 * The list holds every locality of 100,000 people or more, under the name people use for it, with
 * the official INEGI name and the municipality as aliases, plus a few smaller cities where clients
 * already are. Suburban localities are listed under their municipality («Ojo de Agua» → «Tecámac»),
 * and the Mexico City boroughs are aliases of «Ciudad de México».
 */

export interface MexicanState {
	/** Name people use («Coahuila»). */
	name: string;
	/** INEGI official name («Coahuila de Zaragoza»). */
	official: string;
	/** INEGI abbreviation («Coah.»). */
	abbreviation: string;
}

export const MEXICAN_STATES: readonly MexicanState[] = [
	{ name: 'Aguascalientes', official: 'Aguascalientes', abbreviation: 'Ags.' },
	{ name: 'Baja California', official: 'Baja California', abbreviation: 'BC' },
	{ name: 'Baja California Sur', official: 'Baja California Sur', abbreviation: 'BCS' },
	{ name: 'Campeche', official: 'Campeche', abbreviation: 'Camp.' },
	{ name: 'Coahuila', official: 'Coahuila de Zaragoza', abbreviation: 'Coah.' },
	{ name: 'Colima', official: 'Colima', abbreviation: 'Col.' },
	{ name: 'Chiapas', official: 'Chiapas', abbreviation: 'Chis.' },
	{ name: 'Chihuahua', official: 'Chihuahua', abbreviation: 'Chih.' },
	{ name: 'Ciudad de México', official: 'Ciudad de México', abbreviation: 'CDMX' },
	{ name: 'Durango', official: 'Durango', abbreviation: 'Dgo.' },
	{ name: 'Guanajuato', official: 'Guanajuato', abbreviation: 'Gto.' },
	{ name: 'Guerrero', official: 'Guerrero', abbreviation: 'Gro.' },
	{ name: 'Hidalgo', official: 'Hidalgo', abbreviation: 'Hgo.' },
	{ name: 'Jalisco', official: 'Jalisco', abbreviation: 'Jal.' },
	{ name: 'Estado de México', official: 'México', abbreviation: 'Mex.' },
	{ name: 'Michoacán', official: 'Michoacán de Ocampo', abbreviation: 'Mich.' },
	{ name: 'Morelos', official: 'Morelos', abbreviation: 'Mor.' },
	{ name: 'Nayarit', official: 'Nayarit', abbreviation: 'Nay.' },
	{ name: 'Nuevo León', official: 'Nuevo León', abbreviation: 'NL' },
	{ name: 'Oaxaca', official: 'Oaxaca', abbreviation: 'Oax.' },
	{ name: 'Puebla', official: 'Puebla', abbreviation: 'Pue.' },
	{ name: 'Querétaro', official: 'Querétaro', abbreviation: 'Qro.' },
	{ name: 'Quintana Roo', official: 'Quintana Roo', abbreviation: 'Q. Roo' },
	{ name: 'San Luis Potosí', official: 'San Luis Potosí', abbreviation: 'SLP' },
	{ name: 'Sinaloa', official: 'Sinaloa', abbreviation: 'Sin.' },
	{ name: 'Sonora', official: 'Sonora', abbreviation: 'Son.' },
	{ name: 'Tabasco', official: 'Tabasco', abbreviation: 'Tab.' },
	{ name: 'Tamaulipas', official: 'Tamaulipas', abbreviation: 'Tamps.' },
	{ name: 'Tlaxcala', official: 'Tlaxcala', abbreviation: 'Tlax.' },
	{ name: 'Veracruz', official: 'Veracruz de Ignacio de la Llave', abbreviation: 'Ver.' },
	{ name: 'Yucatán', official: 'Yucatán', abbreviation: 'Yuc.' },
	{ name: 'Zacatecas', official: 'Zacatecas', abbreviation: 'Zac.' },
];

export interface MexicanCity {
	name: string;
	/** `MexicanState.name` of the city's state. */
	state: string;
	aliases?: readonly string[];
}

/**
 * Grouped by state. When one spelling names cities in two states («Guadalupe», «Juárez») and the
 * visitor gives no state, the first listed wins, so the larger city comes first.
 */
export const MEXICAN_CITIES: readonly MexicanCity[] = [
	// Chihuahua
	{ name: 'Ciudad Juárez', state: 'Chihuahua', aliases: ['Juárez', 'CDJ', 'Juaritos'] },
	{ name: 'Chihuahua', state: 'Chihuahua', aliases: ['Chihuahua Capital'] },
	{ name: 'Cuauhtémoc', state: 'Chihuahua', aliases: ['Ciudad Cuauhtémoc'] },
	{ name: 'Delicias', state: 'Chihuahua', aliases: ['Ciudad Delicias'] },
	{ name: 'Hidalgo del Parral', state: 'Chihuahua', aliases: ['Parral'] },
	{ name: 'Nuevo Casas Grandes', state: 'Chihuahua' },
	// Ciudad de México
	{
		name: 'Ciudad de México',
		state: 'Ciudad de México',
		aliases: [
			'CDMX',
			'DF',
			'México DF',
			'Distrito Federal',
			'Iztapalapa',
			'Gustavo A. Madero',
			'Álvaro Obregón',
			'Coyoacán',
			'Tlalpan',
			'Venustiano Carranza',
			'Azcapotzalco',
			'Xochimilco',
			'Miguel Hidalgo',
			'Iztacalco',
			'Tláhuac',
			'Magdalena Contreras',
			'La Magdalena Contreras',
			'Cuajimalpa',
			'Cuajimalpa de Morelos',
		],
	},
	// Aguascalientes
	{ name: 'Aguascalientes', state: 'Aguascalientes', aliases: ['Ags'] },
	// Baja California
	{ name: 'Tijuana', state: 'Baja California', aliases: ['TJ'] },
	{ name: 'Mexicali', state: 'Baja California' },
	{ name: 'Ensenada', state: 'Baja California' },
	{ name: 'Playas de Rosarito', state: 'Baja California', aliases: ['Rosarito'] },
	// Baja California Sur
	{ name: 'La Paz', state: 'Baja California Sur' },
	{ name: 'Cabo San Lucas', state: 'Baja California Sur', aliases: ['Los Cabos', 'Cabo'] },
	{ name: 'San José del Cabo', state: 'Baja California Sur' },
	// Campeche
	{ name: 'Campeche', state: 'Campeche', aliases: ['San Francisco de Campeche'] },
	{ name: 'Ciudad del Carmen', state: 'Campeche', aliases: ['Carmen'] },
	// Coahuila
	{ name: 'Saltillo', state: 'Coahuila' },
	{ name: 'Torreón', state: 'Coahuila' },
	{ name: 'Monclova', state: 'Coahuila' },
	{ name: 'Piedras Negras', state: 'Coahuila' },
	{ name: 'Ciudad Acuña', state: 'Coahuila', aliases: ['Acuña'] },
	{ name: 'Ramos Arizpe', state: 'Coahuila' },
	// Colima
	{ name: 'Manzanillo', state: 'Colima' },
	{ name: 'Villa de Álvarez', state: 'Colima', aliases: ['Ciudad de Villa de Álvarez'] },
	{ name: 'Colima', state: 'Colima' },
	// Chiapas
	{ name: 'Tuxtla Gutiérrez', state: 'Chiapas', aliases: ['Tuxtla'] },
	{ name: 'Tapachula', state: 'Chiapas', aliases: ['Tapachula de Córdova y Ordóñez'] },
	{ name: 'San Cristóbal de las Casas', state: 'Chiapas', aliases: ['San Cristóbal'] },
	{ name: 'Comitán', state: 'Chiapas', aliases: ['Comitán de Domínguez'] },
	// Durango
	{ name: 'Durango', state: 'Durango', aliases: ['Victoria de Durango'] },
	{ name: 'Gómez Palacio', state: 'Durango' },
	// Guanajuato
	{ name: 'León', state: 'Guanajuato', aliases: ['León de los Aldama'] },
	{ name: 'Irapuato', state: 'Guanajuato' },
	{ name: 'Celaya', state: 'Guanajuato' },
	{ name: 'Salamanca', state: 'Guanajuato' },
	{ name: 'Guanajuato', state: 'Guanajuato' },
	// Guerrero
	{ name: 'Acapulco', state: 'Guerrero', aliases: ['Acapulco de Juárez'] },
	{ name: 'Chilpancingo', state: 'Guerrero', aliases: ['Chilpancingo de los Bravo'] },
	{ name: 'Iguala', state: 'Guerrero', aliases: ['Iguala de la Independencia'] },
	// Hidalgo
	{ name: 'Pachuca', state: 'Hidalgo', aliases: ['Pachuca de Soto'] },
	{ name: 'Tulancingo', state: 'Hidalgo', aliases: ['Tulancingo de Bravo'] },
	// Jalisco
	{ name: 'Guadalajara', state: 'Jalisco', aliases: ['GDL'] },
	{ name: 'Zapopan', state: 'Jalisco' },
	{ name: 'Tlaquepaque', state: 'Jalisco', aliases: ['San Pedro Tlaquepaque'] },
	{ name: 'Tonalá', state: 'Jalisco' },
	{
		name: 'Tlajomulco de Zúñiga',
		state: 'Jalisco',
		aliases: ['Tlajomulco', 'Hacienda Santa Fe'],
	},
	{ name: 'Puerto Vallarta', state: 'Jalisco', aliases: ['Vallarta'] },
	{ name: 'Ciudad Guzmán', state: 'Jalisco', aliases: ['Zapotlán el Grande'] },
	{ name: 'Lagos de Moreno', state: 'Jalisco' },
	// Estado de México
	{ name: 'Ecatepec', state: 'Estado de México', aliases: ['Ecatepec de Morelos'] },
	{
		name: 'Nezahualcóyotl',
		state: 'Estado de México',
		aliases: ['Ciudad Nezahualcóyotl', 'Neza'],
	},
	{ name: 'Naucalpan', state: 'Estado de México', aliases: ['Naucalpan de Juárez'] },
	{ name: 'Chimalhuacán', state: 'Estado de México' },
	{ name: 'Tlalnepantla', state: 'Estado de México', aliases: ['Tlalnepantla de Baz'] },
	{
		name: 'Atizapán de Zaragoza',
		state: 'Estado de México',
		aliases: ['Atizapán', 'Ciudad López Mateos'],
	},
	{ name: 'Cuautitlán Izcalli', state: 'Estado de México', aliases: ['Izcalli'] },
	{ name: 'Tecámac', state: 'Estado de México', aliases: ['Ojo de Agua'] },
	{
		name: 'Valle de Chalco',
		state: 'Estado de México',
		aliases: ['Valle de Chalco Solidaridad', 'Xico'],
	},
	{ name: 'Ixtapaluca', state: 'Estado de México' },
	{ name: 'Nicolás Romero', state: 'Estado de México', aliases: ['Ciudad Nicolás Romero'] },
	{
		name: 'Coacalco',
		state: 'Estado de México',
		aliases: ['Coacalco de Berriozábal', 'San Francisco Coacalco'],
	},
	{ name: 'Toluca', state: 'Estado de México', aliases: ['Toluca de Lerdo'] },
	{
		name: 'Tultitlán',
		state: 'Estado de México',
		aliases: ['Buenavista', 'San Pablo de las Salinas'],
	},
	{ name: 'Chicoloapan', state: 'Estado de México', aliases: ['Chicoloapan de Juárez'] },
	{ name: 'Chalco', state: 'Estado de México', aliases: ['Chalco de Díaz Covarrubias'] },
	{ name: 'Acolman', state: 'Estado de México', aliases: ['Tepexpan'] },
	{ name: 'Cuautitlán', state: 'Estado de México' },
	// Michoacán
	{ name: 'Morelia', state: 'Michoacán' },
	{ name: 'Uruapan', state: 'Michoacán' },
	{ name: 'Zamora', state: 'Michoacán', aliases: ['Zamora de Hidalgo'] },
	{ name: 'Apatzingán', state: 'Michoacán', aliases: ['Apatzingán de la Constitución'] },
	// Morelos
	{ name: 'Cuernavaca', state: 'Morelos' },
	{ name: 'Jiutepec', state: 'Morelos' },
	{ name: 'Cuautla', state: 'Morelos' },
	{ name: 'Temixco', state: 'Morelos' },
	// Nayarit
	{ name: 'Tepic', state: 'Nayarit' },
	// Nuevo León
	{ name: 'Monterrey', state: 'Nuevo León', aliases: ['MTY'] },
	{ name: 'Guadalupe', state: 'Nuevo León' },
	{ name: 'Apodaca', state: 'Nuevo León', aliases: ['Ciudad Apodaca'] },
	{
		name: 'Escobedo',
		state: 'Nuevo León',
		aliases: ['General Escobedo', 'Ciudad General Escobedo'],
	},
	{ name: 'San Nicolás de los Garza', state: 'Nuevo León', aliases: ['San Nicolás'] },
	{ name: 'Ciudad Benito Juárez', state: 'Nuevo León', aliases: ['Juárez'] },
	{ name: 'Santa Catarina', state: 'Nuevo León', aliases: ['Ciudad Santa Catarina'] },
	{ name: 'García', state: 'Nuevo León' },
	{ name: 'San Pedro Garza García', state: 'Nuevo León', aliases: ['San Pedro'] },
	// Oaxaca
	{ name: 'Oaxaca', state: 'Oaxaca', aliases: ['Oaxaca de Juárez'] },
	{ name: 'Tuxtepec', state: 'Oaxaca', aliases: ['San Juan Bautista Tuxtepec'] },
	// Puebla
	{
		name: 'Puebla',
		state: 'Puebla',
		aliases: ['Puebla de Zaragoza', 'Heroica Puebla de Zaragoza'],
	},
	{ name: 'Tehuacán', state: 'Puebla' },
	{ name: 'Cholula', state: 'Puebla', aliases: ['Cholula de Rivadavia', 'San Pedro Cholula'] },
	// Querétaro
	{ name: 'Querétaro', state: 'Querétaro', aliases: ['Santiago de Querétaro', 'Qro'] },
	{ name: 'San Juan del Río', state: 'Querétaro' },
	{ name: 'Corregidora', state: 'Querétaro', aliases: ['El Pueblito'] },
	// Quintana Roo
	{ name: 'Cancún', state: 'Quintana Roo' },
	{ name: 'Playa del Carmen', state: 'Quintana Roo' },
	{ name: 'Chetumal', state: 'Quintana Roo' },
	// San Luis Potosí
	{ name: 'San Luis Potosí', state: 'San Luis Potosí', aliases: ['SLP'] },
	{ name: 'Soledad de Graciano Sánchez', state: 'San Luis Potosí', aliases: ['Soledad'] },
	{ name: 'Ciudad Valles', state: 'San Luis Potosí', aliases: ['Valles'] },
	// Sinaloa
	{ name: 'Culiacán', state: 'Sinaloa', aliases: ['Culiacán Rosales'] },
	{ name: 'Mazatlán', state: 'Sinaloa' },
	{ name: 'Los Mochis', state: 'Sinaloa', aliases: ['Mochis'] },
	// Sonora
	{ name: 'Hermosillo', state: 'Sonora' },
	{ name: 'Ciudad Obregón', state: 'Sonora', aliases: ['Obregón'] },
	{ name: 'Nogales', state: 'Sonora', aliases: ['Heroica Nogales'] },
	{ name: 'San Luis Río Colorado', state: 'Sonora' },
	{ name: 'Navojoa', state: 'Sonora' },
	{ name: 'Guaymas', state: 'Sonora', aliases: ['Heroica Guaymas'] },
	// Tabasco
	{ name: 'Villahermosa', state: 'Tabasco' },
	// Tamaulipas
	{ name: 'Reynosa', state: 'Tamaulipas' },
	{ name: 'Matamoros', state: 'Tamaulipas', aliases: ['Heroica Matamoros'] },
	{ name: 'Nuevo Laredo', state: 'Tamaulipas' },
	{ name: 'Ciudad Victoria', state: 'Tamaulipas' },
	{ name: 'Tampico', state: 'Tamaulipas' },
	{ name: 'Ciudad Madero', state: 'Tamaulipas' },
	{ name: 'Altamira', state: 'Tamaulipas', aliases: ['Miramar'] },
	{ name: 'Río Bravo', state: 'Tamaulipas', aliases: ['Ciudad Río Bravo'] },
	// Tlaxcala
	{ name: 'Tlaxcala', state: 'Tlaxcala' },
	// Veracruz
	{ name: 'Veracruz', state: 'Veracruz', aliases: ['Puerto de Veracruz'] },
	{ name: 'Xalapa', state: 'Veracruz', aliases: ['Jalapa', 'Xalapa-Enríquez'] },
	{ name: 'Coatzacoalcos', state: 'Veracruz' },
	{ name: 'Poza Rica', state: 'Veracruz', aliases: ['Poza Rica de Hidalgo'] },
	{ name: 'Córdoba', state: 'Veracruz' },
	{ name: 'Orizaba', state: 'Veracruz' },
	{ name: 'Minatitlán', state: 'Veracruz' },
	// Yucatán
	{ name: 'Mérida', state: 'Yucatán' },
	{ name: 'Kanasín', state: 'Yucatán' },
	// Zacatecas
	{ name: 'Fresnillo', state: 'Zacatecas' },
	{ name: 'Zacatecas', state: 'Zacatecas' },
	{ name: 'Guadalupe', state: 'Zacatecas' },
];

/** Comparison key: lowercase, no accents, «Cd.» read as «Ciudad», letters only. */
export function mexicanCityKey(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\bcd\b\.?/g, 'ciudad')
		.replace(/[^a-z]/g, '');
}

let cityIndex: Map<string, MexicanCity[]> | undefined;
let stateIndex: Map<string, MexicanState> | undefined;

function getCityIndex(): Map<string, MexicanCity[]> {
	if (!cityIndex) {
		cityIndex = new Map();
		for (const city of MEXICAN_CITIES) {
			for (const label of [city.name, ...(city.aliases ?? [])]) {
				const key = mexicanCityKey(label);
				const cities = cityIndex.get(key) ?? [];
				if (!cities.includes(city)) cities.push(city);
				cityIndex.set(key, cities);
			}
		}
	}
	return cityIndex;
}

function getStateIndex(): Map<string, MexicanState> {
	if (!stateIndex) {
		stateIndex = new Map();
		for (const state of MEXICAN_STATES) {
			for (const label of [state.name, state.official, state.abbreviation]) {
				stateIndex.set(mexicanCityKey(label), state);
			}
		}
	}
	return stateIndex;
}

/** The listed state a typed value names («Chih.», «Coahuila de Zaragoza», «Edo. de México»). */
export function findMexicanState(value?: string | null): MexicanState | undefined {
	const typed = value?.trim();
	if (!typed) return undefined;
	const key = mexicanCityKey(typed.replace(/\bedo\b\.?/gi, 'estado'));
	return getStateIndex().get(key);
}

function pickCity(cities: MexicanCity[] | undefined, stateHint?: string): MexicanCity | undefined {
	if (!cities || cities.length === 0) return undefined;
	const state = findMexicanState(stateHint);
	return (state && cities.find((city) => city.state === state.name)) || cities[0];
}

/** The listed city a typed value refers to, ignoring case, accents, «Cd.» and a trailing state. */
export function findMexicanCity(value?: string | null): MexicanCity | undefined {
	const typed = value?.trim();
	if (!typed) return undefined;
	const index = getCityIndex();
	const direct = index.get(mexicanCityKey(typed));
	if (direct) return pickCity(direct);
	// «Los Mochis, Sinaloa» or «Guadalupe, Zac.»: the part before the first comma is the city, the
	// rest names its state.
	const commaAt = typed.indexOf(',');
	if (commaAt < 0) return undefined;
	return pickCity(index.get(mexicanCityKey(typed.slice(0, commaAt))), typed.slice(commaAt + 1));
}

/** Common and INEGI official names of a listed city's state, for Meta `st` candidates. */
export function getMexicanStateNames(city?: MexicanCity): string[] {
	const state = city && MEXICAN_STATES.find((entry) => entry.name === city.state);
	return state ? [...new Set([state.name, state.official])] : [];
}

/** The canonical spelling of a listed city, or the typed value trimmed when it is not listed. */
export function canonicalizeMexicanCity(value?: string | null): string | undefined {
	const typed = value?.trim().replace(/\s+/g, ' ');
	if (!typed) return undefined;
	return findMexicanCity(typed)?.name ?? typed;
}
