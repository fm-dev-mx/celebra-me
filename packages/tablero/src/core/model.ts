// Task model: five states, one integer order, waits and reviews recorded inside the task.

export const ESTADOS = ['siguiente', 'en curso', 'en revision', 'hecho', 'cancelada'] as const;
export type Estado = (typeof ESTADOS)[number];

/** A wait is either another task (dependency) or an external condition (date, payment, owner). */
export type Espera =
	{ tarea: string } | { externa: string; hasta?: string; dueno?: boolean; cumplida?: boolean };

export type Veredicto = 'aprobada' | 'cambios';

export interface Revision {
	sha: string;
	revisor: string;
	veredicto: Veredicto;
	hallazgos: string[];
	en: string;
}

export interface Decision {
	pregunta: string;
	respuesta: string;
	en: string;
}

export interface Candado {
	quien: string;
	desde: string;
}

export interface Tarea {
	id: string;
	num: number;
	titulo: string;
	/** Short public title for notifications; never carries private names. */
	aviso?: string;
	estado: Estado;
	/** 1-based position, present only while `estado` is `siguiente`. */
	orden?: number;
	espera: Espera[];
	carril?: string;
	agente?: string;
	rama?: string;
	pr?: number;
	tipoPrompt?: string;
	prompt?: string;
	candado?: Candado;
	revisiones: Revision[];
	decisiones: Decision[];
	rev: number;
	creada: string;
	actualizado: string;
}

const TRANSICIONES: Record<Estado, readonly Estado[]> = {
	siguiente: ['en curso', 'cancelada'],
	'en curso': ['siguiente', 'en revision', 'hecho', 'cancelada'],
	'en revision': ['en curso', 'hecho', 'cancelada'],
	hecho: [],
	cancelada: ['siguiente'],
};

export class TableroError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
	}
}

export function puedeTransitar(de: Estado, a: Estado): boolean {
	return TRANSICIONES[de].includes(a);
}

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function esId(value: unknown): value is string {
	return typeof value === 'string' && ID.test(value);
}

export function esEsperaDeTarea(espera: Espera): espera is { tarea: string } {
	return 'tarea' in espera;
}

/**
 * External waits are met once marked. A plain date wait is also met when its date passes; an
 * owner wait (`dueno`) only becomes actionable then and stays pending until the owner marks it.
 */
export function esperaCumplida(espera: Espera, tareas: Map<string, Tarea>, ahora: Date): boolean {
	if (esEsperaDeTarea(espera)) return tareas.get(espera.tarea)?.estado === 'hecho';
	if (espera.cumplida) return true;
	return Boolean(!espera.dueno && espera.hasta && Date.parse(espera.hasta) <= ahora.getTime());
}

export function esperasPendientes(tarea: Tarea, tareas: Map<string, Tarea>, ahora: Date): Espera[] {
	return tarea.espera.filter((espera) => !esperaCumplida(espera, tareas, ahora));
}

/** Parked tasks wait on something outside the board; dependencies alone do not park a task. */
export function estaEstacionada(tarea: Tarea, tareas: Map<string, Tarea>, ahora: Date): boolean {
	return (
		tarea.estado === 'siguiente' &&
		esperasPendientes(tarea, tareas, ahora).some((espera) => !esEsperaDeTarea(espera))
	);
}

export interface NuevaTarea {
	id: string;
	num: number;
	titulo: string;
	aviso?: string;
	espera?: Espera[];
	carril?: string;
	agente?: string;
	tipoPrompt?: string;
	prompt?: string;
}

export function crearTarea(datos: NuevaTarea, ahora: Date): Tarea {
	if (!esId(datos.id)) throw new TableroError('id', `Invalid task id: ${String(datos.id)}`);
	if (!Number.isInteger(datos.num) || datos.num < 1) {
		throw new TableroError('num', `Invalid task number: ${String(datos.num)}`);
	}
	if (!datos.titulo?.trim()) throw new TableroError('titulo', 'A task needs a title');
	const en = ahora.toISOString();
	const tarea: Tarea = {
		id: datos.id,
		num: datos.num,
		titulo: datos.titulo.trim(),
		estado: 'siguiente',
		espera: (datos.espera ?? []).map(validarEspera),
		revisiones: [],
		decisiones: [],
		rev: 1,
		creada: en,
		actualizado: en,
	};
	for (const clave of ['aviso', 'carril', 'agente', 'tipoPrompt', 'prompt'] as const) {
		if (datos[clave]) tarea[clave] = datos[clave];
	}
	return tarea;
}

export function validarEspera(espera: Espera): Espera {
	if (esEsperaDeTarea(espera)) {
		if (!esId(espera.tarea)) throw new TableroError('espera', 'A dependency needs a task id');
		return { tarea: espera.tarea };
	}
	if (!espera.externa?.trim()) throw new TableroError('espera', 'An external wait needs a text');
	if (espera.hasta && Number.isNaN(Date.parse(espera.hasta))) {
		throw new TableroError('espera', `Invalid date: ${espera.hasta}`);
	}
	return { ...espera, externa: espera.externa.trim() };
}

export interface Transicion {
	a: Estado;
	quien: string;
	pr?: number;
	rama?: string;
}

/**
 * Applies a state change without touching order; `order.ts` renumbers the queue afterwards.
 * Starting a task takes its lock, so callers must enforce the WIP limit first.
 */
export function transitar(
	tarea: Tarea,
	cambio: Transicion,
	tareas: Map<string, Tarea>,
	ahora: Date,
): Tarea {
	if (!puedeTransitar(tarea.estado, cambio.a)) {
		throw new TableroError(
			'transicion',
			`${tarea.id}: ${tarea.estado} → ${cambio.a} is not allowed`,
		);
	}
	if (cambio.a === 'en curso' && tarea.estado === 'siguiente') {
		const pendientes = esperasPendientes(tarea, tareas, ahora);
		if (pendientes.length > 0) {
			throw new TableroError(
				'espera',
				`${tarea.id} still waits on ${describirEsperas(pendientes)}`,
			);
		}
	}
	const pr = cambio.pr ?? tarea.pr;
	if (cambio.a === 'en revision' && !pr) {
		throw new TableroError('pr', `${tarea.id} needs a pull request before review`);
	}
	const siguiente: Tarea = { ...tarea, estado: cambio.a };
	if (pr) siguiente.pr = pr;
	if (cambio.rama) siguiente.rama = cambio.rama;
	if (cambio.a === 'en curso')
		siguiente.candado = { quien: cambio.quien, desde: ahora.toISOString() };
	else delete siguiente.candado;
	if (cambio.a !== 'siguiente') delete siguiente.orden;
	return siguiente;
}

export function registrarRevision(
	tarea: Tarea,
	revision: Omit<Revision, 'en'>,
	ahora: Date,
): Tarea {
	if (tarea.estado !== 'en revision') {
		throw new TableroError('revision', `${tarea.id} is not in review`);
	}
	if (!/^[0-9a-f]{7,40}$/.test(revision.sha)) {
		throw new TableroError('revision', `Invalid commit sha: ${revision.sha}`);
	}
	if (revision.veredicto !== 'aprobada' && revision.veredicto !== 'cambios') {
		throw new TableroError('revision', `Invalid verdict: ${String(revision.veredicto)}`);
	}
	const registro: Revision = {
		...revision,
		hallazgos: [...revision.hallazgos],
		en: ahora.toISOString(),
	};
	return { ...tarea, revisiones: [...tarea.revisiones, registro] };
}

export function ultimaRevision(tarea: Tarea): Revision | undefined {
	return tarea.revisiones.at(-1);
}

export function describirEsperas(esperas: Espera[]): string {
	return esperas
		.map((espera) => (esEsperaDeTarea(espera) ? espera.tarea : espera.externa))
		.join(', ');
}
