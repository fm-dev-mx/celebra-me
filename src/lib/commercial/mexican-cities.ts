/**
 * Canonical Mexican cities for the «Aparta su fecha» city field.
 *
 * The form offers these names as suggestions; whatever the visitor types is matched against the
 * names and aliases («Cd. Juárez», «Juarez», «CDJ» → «Ciudad Juárez») so the customer record and
 * the hashed Meta `ct`/`st` keys get one spelling per city. A city outside the list is kept as
 * typed. Client-safe: plain data, no server imports.
 */

export interface MexicanCity {
	name: string;
	state: string;
	aliases?: readonly string[];
}

export const MEXICAN_CITIES: readonly MexicanCity[] = [
	{ name: 'Ciudad Juárez', state: 'Chihuahua', aliases: ['Juárez', 'CDJ', 'Juaritos'] },
	{ name: 'Chihuahua', state: 'Chihuahua', aliases: ['Chihuahua Capital'] },
	{ name: 'Delicias', state: 'Chihuahua', aliases: ['Ciudad Delicias'] },
	{ name: 'Cuauhtémoc', state: 'Chihuahua', aliases: ['Ciudad Cuauhtémoc'] },
	{ name: 'Hidalgo del Parral', state: 'Chihuahua', aliases: ['Parral'] },
	{ name: 'Nuevo Casas Grandes', state: 'Chihuahua' },
	{
		name: 'Ciudad de México',
		state: 'Ciudad de México',
		aliases: ['CDMX', 'DF', 'México DF', 'Distrito Federal'],
	},
	{ name: 'Guadalajara', state: 'Jalisco', aliases: ['GDL'] },
	{ name: 'Zapopan', state: 'Jalisco' },
	{ name: 'Puerto Vallarta', state: 'Jalisco', aliases: ['Vallarta'] },
	{ name: 'Monterrey', state: 'Nuevo León', aliases: ['MTY'] },
	{ name: 'San Pedro Garza García', state: 'Nuevo León', aliases: ['San Pedro'] },
	{ name: 'Apodaca', state: 'Nuevo León' },
	{ name: 'Guadalupe', state: 'Nuevo León' },
	{ name: 'Puebla', state: 'Puebla', aliases: ['Puebla de Zaragoza'] },
	{ name: 'Tijuana', state: 'Baja California', aliases: ['TJ'] },
	{ name: 'Mexicali', state: 'Baja California' },
	{ name: 'Ensenada', state: 'Baja California' },
	{ name: 'La Paz', state: 'Baja California Sur' },
	{
		name: 'Los Cabos',
		state: 'Baja California Sur',
		aliases: ['Cabo San Lucas', 'San José del Cabo'],
	},
	{ name: 'Hermosillo', state: 'Sonora' },
	{ name: 'Ciudad Obregón', state: 'Sonora', aliases: ['Obregón'] },
	{ name: 'Nogales', state: 'Sonora' },
	{ name: 'Culiacán', state: 'Sinaloa' },
	{ name: 'Mazatlán', state: 'Sinaloa' },
	{ name: 'Los Mochis', state: 'Sinaloa', aliases: ['Mochis'] },
	{ name: 'Durango', state: 'Durango', aliases: ['Victoria de Durango'] },
	{ name: 'Gómez Palacio', state: 'Durango' },
	{ name: 'Torreón', state: 'Coahuila' },
	{ name: 'Saltillo', state: 'Coahuila' },
	{ name: 'Monclova', state: 'Coahuila' },
	{ name: 'Piedras Negras', state: 'Coahuila' },
	{ name: 'Reynosa', state: 'Tamaulipas' },
	{ name: 'Matamoros', state: 'Tamaulipas' },
	{ name: 'Nuevo Laredo', state: 'Tamaulipas' },
	{ name: 'Tampico', state: 'Tamaulipas' },
	{ name: 'Ciudad Victoria', state: 'Tamaulipas' },
	{ name: 'Zacatecas', state: 'Zacatecas' },
	{ name: 'Aguascalientes', state: 'Aguascalientes', aliases: ['Ags'] },
	{ name: 'San Luis Potosí', state: 'San Luis Potosí', aliases: ['SLP'] },
	{ name: 'León', state: 'Guanajuato' },
	{ name: 'Irapuato', state: 'Guanajuato' },
	{ name: 'Celaya', state: 'Guanajuato' },
	{ name: 'Guanajuato', state: 'Guanajuato' },
	{ name: 'Querétaro', state: 'Querétaro', aliases: ['Santiago de Querétaro', 'Qro'] },
	{ name: 'Morelia', state: 'Michoacán' },
	{ name: 'Uruapan', state: 'Michoacán' },
	{ name: 'Toluca', state: 'Estado de México' },
	{ name: 'Naucalpan', state: 'Estado de México' },
	{ name: 'Ecatepec', state: 'Estado de México' },
	{ name: 'Nezahualcóyotl', state: 'Estado de México', aliases: ['Neza'] },
	{ name: 'Pachuca', state: 'Hidalgo' },
	{ name: 'Cuernavaca', state: 'Morelos' },
	{ name: 'Tlaxcala', state: 'Tlaxcala' },
	{ name: 'Tepic', state: 'Nayarit' },
	{ name: 'Colima', state: 'Colima' },
	{ name: 'Manzanillo', state: 'Colima' },
	{ name: 'Acapulco', state: 'Guerrero' },
	{ name: 'Chilpancingo', state: 'Guerrero' },
	{ name: 'Oaxaca', state: 'Oaxaca', aliases: ['Oaxaca de Juárez'] },
	{ name: 'Veracruz', state: 'Veracruz', aliases: ['Puerto de Veracruz'] },
	{ name: 'Xalapa', state: 'Veracruz', aliases: ['Jalapa'] },
	{ name: 'Coatzacoalcos', state: 'Veracruz' },
	{ name: 'Villahermosa', state: 'Tabasco' },
	{ name: 'Tuxtla Gutiérrez', state: 'Chiapas', aliases: ['Tuxtla'] },
	{ name: 'Tapachula', state: 'Chiapas' },
	{ name: 'Campeche', state: 'Campeche' },
	{ name: 'Mérida', state: 'Yucatán' },
	{ name: 'Cancún', state: 'Quintana Roo' },
	{ name: 'Playa del Carmen', state: 'Quintana Roo' },
	{ name: 'Chetumal', state: 'Quintana Roo' },
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

let cityIndex: Map<string, MexicanCity> | undefined;

function getCityIndex(): Map<string, MexicanCity> {
	if (!cityIndex) {
		cityIndex = new Map();
		for (const city of MEXICAN_CITIES) {
			for (const label of [city.name, ...(city.aliases ?? [])]) {
				cityIndex.set(mexicanCityKey(label), city);
			}
		}
	}
	return cityIndex;
}

/** The listed city a typed value refers to, ignoring case, accents, «Cd.» and a trailing state. */
export function findMexicanCity(value?: string | null): MexicanCity | undefined {
	const typed = value?.trim();
	if (!typed) return undefined;
	const index = getCityIndex();
	const direct = index.get(mexicanCityKey(typed));
	if (direct) return direct;
	// «Los Mochis, Sinaloa» or «Juárez, Chih.»: try the part before the first comma.
	const beforeComma = typed.split(',')[0];
	return beforeComma !== typed ? index.get(mexicanCityKey(beforeComma)) : undefined;
}

/** The canonical spelling of a listed city, or the typed value trimmed when it is not listed. */
export function canonicalizeMexicanCity(value?: string | null): string | undefined {
	const typed = value?.trim().replace(/\s+/g, ' ');
	if (!typed) return undefined;
	return findMexicanCity(typed)?.name ?? typed;
}
