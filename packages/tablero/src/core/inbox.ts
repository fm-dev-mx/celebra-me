// Owner inbox: only three kinds of rows, each answered with one button.

import { esEsperaDeTarea, TableroError, type Tarea } from './model.ts';

export const TIPOS_BANDEJA = ['decidir', 'aprobar', 'hacer'] as const;
export type TipoBandeja = (typeof TIPOS_BANDEJA)[number];

export const RESPUESTAS_APROBAR = ['aprobar', 'cambios'] as const;
export const RESPUESTA_HACER = 'hecho';

export interface ItemBandeja {
	id: string;
	tipo: TipoBandeja;
	tarea: string;
	texto: string;
	/** `decidir` only: the options offered, first one recommended. */
	opciones?: string[];
	/** `aprobar` only: where to look before approving (a pull request or preview). */
	url?: string;
	/** `hacer` only: index of the owner wait this row clears. */
	espera?: number;
	creado: string;
	resuelto?: { en: string; respuesta: string; quien: string };
}

export interface NuevoItem {
	tipo: TipoBandeja;
	tarea: string;
	texto: string;
	opciones?: string[];
	url?: string;
	espera?: number;
}

function clave(item: Pick<ItemBandeja, 'tipo' | 'tarea' | 'texto' | 'espera'>): string {
	return [item.tipo, item.tarea, item.texto.trim().toLowerCase(), item.espera ?? ''].join(
		'\u0000',
	);
}

export function abiertos(items: readonly ItemBandeja[]): ItemBandeja[] {
	return items.filter((item) => !item.resuelto);
}

function validar(nuevo: NuevoItem): void {
	if (!TIPOS_BANDEJA.includes(nuevo.tipo)) {
		throw new TableroError('bandeja', `Unknown inbox type: ${String(nuevo.tipo)}`);
	}
	if (!nuevo.texto?.trim()) throw new TableroError('bandeja', 'An inbox row needs a text');
	if (nuevo.tipo === 'decidir' && (nuevo.opciones?.length ?? 0) < 2) {
		throw new TableroError('bandeja', 'A decision needs at least two options');
	}
	if (nuevo.tipo !== 'decidir' && nuevo.opciones) {
		throw new TableroError('bandeja', 'Only decisions carry options');
	}
	if (nuevo.url && !/^https?:\/\//.test(nuevo.url)) {
		throw new TableroError('bandeja', `Invalid link: ${nuevo.url}`);
	}
}

/** Adds a row unless an identical open one exists; repeated questions collapse into one row. */
export function agregar(
	items: readonly ItemBandeja[],
	nuevo: NuevoItem,
	ahora: Date,
): { items: ItemBandeja[]; item: ItemBandeja; creado: boolean } {
	validar(nuevo);
	const existente = abiertos(items).find((item) => clave(item) === clave(nuevo));
	if (existente) return { items: [...items], item: existente, creado: false };
	const en = ahora.toISOString();
	const item: ItemBandeja = {
		id: `${en.replace(/[-:.]/g, '').slice(0, 15)}-${nuevo.tipo}-${items.length + 1}`,
		tipo: nuevo.tipo,
		tarea: nuevo.tarea,
		texto: nuevo.texto.trim(),
		creado: en,
	};
	if (nuevo.opciones) item.opciones = nuevo.opciones.map((opcion) => opcion.trim());
	if (nuevo.url) item.url = nuevo.url;
	if (nuevo.espera !== undefined) item.espera = nuevo.espera;
	return { items: [...items, item], item, creado: true };
}

function respuestasValidas(item: ItemBandeja): readonly string[] {
	if (item.tipo === 'decidir') return item.opciones ?? [];
	if (item.tipo === 'aprobar') return RESPUESTAS_APROBAR;
	return [RESPUESTA_HACER];
}

export function resolver(
	items: readonly ItemBandeja[],
	id: string,
	respuesta: string,
	quien: string,
	ahora: Date,
): { items: ItemBandeja[]; item: ItemBandeja } {
	const actual = items.find((item) => item.id === id);
	if (!actual) throw new TableroError('bandeja', `Unknown inbox row: ${id}`);
	if (actual.resuelto) throw new TableroError('bandeja', `${id} was already answered`);
	if (!respuestasValidas(actual).includes(respuesta)) {
		throw new TableroError('bandeja', `${id} does not accept «${respuesta}»`);
	}
	const item: ItemBandeja = {
		...actual,
		resuelto: { en: ahora.toISOString(), respuesta, quien },
	};
	return { items: items.map((x) => (x.id === id ? item : x)), item };
}

/** Records the answer on the task it belongs to: a decision or a met owner wait. */
export function aplicarRespuesta(tarea: Tarea, item: ItemBandeja): Tarea {
	if (!item.resuelto) return tarea;
	if (item.tipo === 'decidir') {
		const decision = {
			pregunta: item.texto,
			respuesta: item.resuelto.respuesta,
			en: item.resuelto.en,
		};
		return { ...tarea, decisiones: [...tarea.decisiones, decision] };
	}
	if (item.tipo === 'hacer' && item.espera !== undefined) {
		const espera = tarea.espera.map((actual, indice) =>
			indice === item.espera && !esEsperaDeTarea(actual)
				? { ...actual, cumplida: true }
				: actual,
		);
		return { ...tarea, espera };
	}
	return tarea;
}

/**
 * Owner waits that are actionable now (no date, or date reached) and have no open row yet.
 * Parked tasks stay out of the inbox until their date arrives.
 */
export function esperasDelDueno(
	tareas: Iterable<Tarea>,
	items: readonly ItemBandeja[],
	ahora: Date,
): NuevoItem[] {
	const nuevos: NuevoItem[] = [];
	const tomados = new Set(abiertos(items).map(clave));
	for (const tarea of tareas) {
		if (tarea.estado === 'hecho' || tarea.estado === 'cancelada') continue;
		tarea.espera.forEach((espera, indice) => {
			if (esEsperaDeTarea(espera) || !espera.dueno || espera.cumplida) return;
			if (espera.hasta && Date.parse(espera.hasta) > ahora.getTime()) return;
			const nuevo: NuevoItem = {
				tipo: 'hacer',
				tarea: tarea.id,
				texto: espera.externa,
				espera: indice,
			};
			if (!tomados.has(clave(nuevo))) nuevos.push(nuevo);
		});
	}
	return nuevos;
}

export interface ResumenBandeja {
	decidir: number;
	aprobar: number;
	hacer: number;
	/** Public rows only: tasks without an `aviso` are counted but never named. */
	filas: { num: number; tipo: TipoBandeja; aviso: string }[];
}

export function resumir(items: readonly ItemBandeja[], tareas: Map<string, Tarea>): ResumenBandeja {
	const resumen: ResumenBandeja = { decidir: 0, aprobar: 0, hacer: 0, filas: [] };
	for (const item of abiertos(items)) {
		resumen[item.tipo] += 1;
		const tarea = tareas.get(item.tarea);
		if (tarea?.aviso)
			resumen.filas.push({ num: tarea.num, tipo: item.tipo, aviso: tarea.aviso });
	}
	return resumen;
}
