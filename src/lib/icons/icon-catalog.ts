export const ICON_CATALOG = [
	{
		name: 'Accordion',
		label: 'Acordeón',
		category: 'music',
		keywords: ['musica', 'instrumento', 'norteño', 'regional'],
	},
	{
		name: 'BootSeal',
		label: 'Bota',
		category: 'western',
		keywords: ['bota', 'western', 'vaquero', 'charro'],
	},
	{
		name: 'Cake',
		label: 'Pastel',
		category: 'reception',
		keywords: ['pastel', 'dulce', 'postre', 'torta'],
	},
	{
		name: 'Calendar',
		label: 'Calendario',
		category: 'info',
		keywords: ['fecha', 'calendario', 'dia', 'evento'],
	},
	{
		name: 'CheckSeal',
		label: 'Confirmado',
		category: 'info',
		keywords: ['confirmado', 'aprobado', 'check', 'verificado'],
	},
	{
		name: 'Church',
		label: 'Iglesia',
		category: 'ceremony',
		keywords: ['iglesia', 'ceremonia', 'religioso', 'misa'],
	},
	{
		name: 'Crown',
		label: 'Corona',
		category: 'decorative',
		keywords: ['corona', 'realeza', 'princesa', 'reina'],
	},
	{
		name: 'Diamond',
		label: 'Diamante',
		category: 'decorative',
		keywords: ['diamante', 'joya', 'lujo', 'brillante'],
	},
	{
		name: 'Dinner',
		label: 'Cena',
		category: 'reception',
		keywords: ['cena', 'comida', 'cubiertos', 'banquete'],
	},
	{
		name: 'Dove',
		label: 'Paloma',
		category: 'ceremony',
		keywords: ['paloma', 'paz', 'amor', 'blanca'],
	},
	{
		name: 'DressCode',
		label: 'Código de vestimenta',
		category: 'dress',
		keywords: ['vestimenta', 'formal', 'ropa', 'etiqueta', 'traje'],
	},
	{
		name: 'Enveloped',
		label: 'Sobre',
		category: 'info',
		keywords: ['sobre', 'carta', 'correo', 'invitacion'],
	},
	{
		name: 'FlowerSeal',
		label: 'Flor',
		category: 'decorative',
		keywords: ['flor', 'sello', 'decoracion', 'jardin'],
	},
	{
		name: 'Forbidden',
		label: 'Prohibido',
		category: 'info',
		keywords: ['prohibido', 'no', 'restriccion', 'aviso'],
	},
	{
		name: 'Gift',
		label: 'Regalo',
		category: 'gifts',
		keywords: ['regalo', 'presente', 'mesa', 'sobre'],
	},
	{
		name: 'Heartbreak',
		label: 'Corazón roto',
		category: 'info',
		keywords: ['corazon', 'roto', 'tristeza', 'no', 'rechazado'],
	},
	{
		name: 'HeartSeal',
		label: 'Corazón',
		category: 'decorative',
		keywords: ['corazon', 'amor', 'sello', 'romantico'],
	},
	{
		name: 'Heel',
		label: 'Tacón',
		category: 'dress',
		keywords: ['tacon', 'zapato', 'fashion', 'vestimenta'],
	},
	{
		name: 'MapLocation',
		label: 'Ubicación',
		category: 'info',
		keywords: ['ubicacion', 'mapa', 'direccion', 'lugar'],
	},
	{
		name: 'MonogramSeal',
		label: 'Monograma',
		category: 'decorative',
		keywords: ['monograma', 'iniciales', 'sello', 'letras'],
	},
	{
		name: 'Party',
		label: 'Fiesta',
		category: 'party',
		keywords: ['fiesta', 'baile', 'celebracion', 'diversion'],
	},
	{
		name: 'Photo',
		label: 'Fotografía',
		category: 'info',
		keywords: ['foto', 'fotografia', 'camara', 'recuerdo'],
	},
	{
		name: 'Reception',
		label: 'Recepción',
		category: 'reception',
		keywords: ['recepcion', 'salon', 'evento', 'celebracion'],
	},
	{
		name: 'Rings',
		label: 'Anillos',
		category: 'ceremony',
		keywords: ['anillos', 'argollas', 'matrimonio', 'boda'],
	},
	{
		name: 'Sparkles',
		label: 'Destacado',
		category: 'decorative',
		keywords: ['brillos', 'destacado', 'especial', 'estrella'],
	},
	{
		name: 'Taco',
		label: 'Tacos',
		category: 'reception',
		keywords: ['tacos', 'comida', 'mexicano', 'antojitos'],
	},
	{
		name: 'Toast',
		label: 'Brindis',
		category: 'reception',
		keywords: ['brindis', 'salud', 'copas', 'champagne'],
	},
	{
		name: 'Tuba',
		label: 'Tuba',
		category: 'music',
		keywords: ['tuba', 'musica', 'banda', 'instrumento'],
	},
	{
		name: 'Waltz',
		label: 'Vals',
		category: 'party',
		keywords: ['vals', 'baile', 'danza', 'musica'],
	},
	{
		name: 'WesternHat',
		label: 'Sombrero',
		category: 'western',
		keywords: ['sombrero', 'western', 'vaquero', 'charro'],
	},
] as const;

export type IconName = (typeof ICON_CATALOG)[number]['name'];
export type IconCategory = (typeof ICON_CATALOG)[number]['category'];

export const ICON_NAMES: readonly IconName[] = ICON_CATALOG.map((entry) => entry.name);
export const DEFAULT_ICON: IconName = ICON_CATALOG[0].name;

export function isIconName(value: unknown): value is IconName {
	return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}

export function iconNamesTuple(): [IconName, ...IconName[]] {
	if (ICON_NAMES.length === 0) {
		throw new Error('ICON_CATALOG is empty — cannot create enum');
	}
	return ICON_NAMES as unknown as [IconName, ...IconName[]];
}
