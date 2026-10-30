// Dry-run migration from the legacy board layout (`<dir>/<id>.json`, one file per task).
// It prints how each task would look in the new model and never writes anything.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { esId, type Espera, type Estado, type Revision, type Tarea } from './core/model.ts';

type Legada = Record<string, unknown> & { id: string };

interface Requisito {
	tipo?: string;
	ref?: string;
	ok?: boolean;
}

export interface Migrada {
	tarea: Tarea;
	/** Log facts the real migration would append, e.g. `merged`, `verified`. */
	hechos: ('merged' | 'verified')[];
	notas: string[];
}

export interface ResultadoMigracion {
	tareas: Migrada[];
	/** Legacy review tasks folded into their origin task. */
	revisionesPlegadas: number;
	avisos: string[];
}

const ESTADOS: Record<string, Estado> = {
	pendiente: 'siguiente',
	bloqueada: 'siguiente',
	'en curso': 'en curso',
	'en revision': 'en revision',
	hecha: 'hecho',
	unida: 'hecho',
	comprobada: 'hecho',
	cancelada: 'cancelada',
};

function texto(valor: unknown): string | undefined {
	return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

function numeroPr(valor: unknown): number | undefined {
	const n = Number(String(valor ?? '').replace(/^#/, ''));
	return Number.isInteger(n) && n > 0 ? n : undefined;
}

function esperaDe(requisito: Requisito): Espera | undefined {
	const ref = texto(requisito.ref);
	if (!ref) return undefined;
	switch (requisito.tipo) {
		case 'tarea':
			return { tarea: ref };
		case 'fecha':
			return {
				externa: `fecha ${ref}`,
				hasta: ref,
				...(requisito.ok ? { cumplida: true } : {}),
			};
		case 'dueno':
			return { externa: ref, dueno: true, ...(requisito.ok ? { cumplida: true } : {}) };
		case 'decision':
			return { externa: `decisión ${ref}`, ...(requisito.ok ? { cumplida: true } : {}) };
		default:
			return undefined; // `revision` requirements become review records instead
	}
}

function revisionDe(legada: Legada): (Omit<Revision, 'en'> & { en?: string }) | undefined {
	const cierre = (legada.cierre ?? {}) as Record<string, unknown>;
	const resultado = (cierre.resultado ?? {}) as Record<string, unknown>;
	const sha = texto(resultado.sha) ?? texto(legada.revisionSha);
	const veredicto =
		resultado.veredicto === 'aprobado'
			? 'aprobada'
			: resultado.veredicto === 'cambios'
				? 'cambios'
				: undefined;
	if (!sha || !veredicto) return undefined;
	const hallazgos = Array.isArray(resultado.hallazgos)
		? resultado.hallazgos.map((h: Record<string, unknown>) =>
				[h.p, h.archivo, h.texto]
					.filter((parte) => typeof parte === 'string' && parte)
					.join(' '),
			)
		: [];
	return {
		sha,
		revisor: texto(legada.revisor) ?? texto(legada.agente) ?? 'desconocido',
		veredicto,
		hallazgos,
		en: texto(cierre.en),
	};
}

export function leerLegado(dir: string): Legada[] {
	if (!existsSync(dir)) throw new Error(`Legacy task directory not found: ${dir}`);
	return readdirSync(dir)
		.filter((nombre) => nombre.endsWith('.json'))
		.map((nombre) => ({
			...(JSON.parse(readFileSync(path.join(dir, nombre), 'utf8')) as Record<
				string,
				unknown
			>),
			id: nombre.slice(0, -5),
		}));
}

type Plegadas = Map<string, NonNullable<ReturnType<typeof revisionDe>>[]>;

/** Folds review tasks into review records on their origin task. */
function plegarRevisiones(
	legadas: readonly Legada[],
	avisos: string[],
): { revisiones: Plegadas; plegadas: Set<string> } {
	const existentes = new Set(legadas.map((legada) => legada.id));
	const revisiones: Plegadas = new Map();
	const plegadas = new Set<string>();
	for (const legada of legadas) {
		if (legada.tipo !== 'revision') continue;
		const origen = texto(legada.origen);
		const revision = revisionDe(legada);
		if (origen && existentes.has(origen) && revision) {
			revisiones.set(origen, [...(revisiones.get(origen) ?? []), revision]);
			plegadas.add(legada.id);
		} else if (legada.estado !== 'cancelada') {
			avisos.push(`${legada.id}: review task without origin or verdict, kept as a task`);
		}
	}
	return { revisiones, plegadas };
}

function copiarOpcionales(legada: Legada, tarea: Tarea, estado: Estado): void {
	for (const clave of ['carril', 'agente', 'rama', 'prompt'] as const) {
		const valor = texto(legada[clave]);
		if (valor) tarea[clave] = valor;
	}
	const pr = numeroPr(legada.pr);
	if (pr) tarea.pr = pr;
	if (texto(legada.tipo)) tarea.tipoPrompt = texto(legada.tipo);
	const candado = legada.candado as { agente?: string; desde?: string } | undefined;
	if (estado === 'en curso' && candado?.agente && candado.desde) {
		tarea.candado = { quien: candado.agente, desde: candado.desde };
	}
}

function migrarUna(legada: Legada, revisiones: Plegadas, avisos: string[]): Migrada | undefined {
	const estadoLegado = String(legada.estado ?? '');
	const estado = ESTADOS[estadoLegado];
	const num = Number(legada.num);
	const titulo = texto(legada.titulo);
	if (!estado || !esId(legada.id) || !Number.isInteger(num) || !titulo) {
		avisos.push(`${legada.id}: skipped (state «${estadoLegado}», num ${String(legada.num)})`);
		return undefined;
	}
	const actualizado = texto(legada.actualizado) ?? new Date(0).toISOString();
	const requisitos = Array.isArray(legada.requisitos) ? (legada.requisitos as Requisito[]) : [];
	const tarea: Tarea = {
		id: legada.id,
		num,
		titulo,
		estado,
		espera: requisitos.map(esperaDe).filter((espera): espera is Espera => Boolean(espera)),
		revisiones: (revisiones.get(legada.id) ?? []).map((r) => ({
			...r,
			en: r.en ?? actualizado,
		})),
		decisiones: [],
		rev: 1,
		creada: actualizado,
		actualizado,
	};
	copiarOpcionales(legada, tarea, estado);
	const notas: string[] = [];
	if (estado === 'en revision' && !tarea.pr) notas.push('in review without a pull request');
	if (estadoLegado === 'bloqueada' && tarea.espera.length === 0)
		notas.push('blocked without requirements');
	const hechos: Migrada['hechos'] = [];
	if (estadoLegado === 'unida' || estadoLegado === 'comprobada') hechos.push('merged');
	if (estadoLegado === 'comprobada') hechos.push('verified');
	return { tarea, hechos, notas };
}

export function migrar(legadas: readonly Legada[]): ResultadoMigracion {
	const avisos: string[] = [];
	const { revisiones, plegadas } = plegarRevisiones(legadas, avisos);
	const tareas = legadas
		.filter((legada) => !plegadas.has(legada.id))
		.map((legada) => migrarUna(legada, revisiones, avisos))
		.filter((migrada): migrada is Migrada => Boolean(migrada));

	const cola = tareas
		.filter(({ tarea }) => tarea.estado === 'siguiente')
		.sort((a, b) => a.tarea.num - b.tarea.num);
	cola.forEach(({ tarea }, i) => (tarea.orden = i + 1));
	const ids = new Set(tareas.map(({ tarea }) => tarea.id));
	for (const { tarea, notas } of tareas) {
		for (const espera of tarea.espera) {
			if ('tarea' in espera && !ids.has(espera.tarea))
				notas.push(`depends on unknown task ${espera.tarea}`);
		}
	}
	return {
		tareas: tareas.sort((a, b) => a.tarea.num - b.tarea.num),
		revisionesPlegadas: plegadas.size,
		avisos,
	};
}

export function informe(resultado: ResultadoMigracion): string {
	const lineas: string[] = [];
	const porEstado = new Map<string, number>();
	for (const { tarea, hechos, notas } of resultado.tareas) {
		porEstado.set(tarea.estado, (porEstado.get(tarea.estado) ?? 0) + 1);
		const partes = [
			`T${tarea.num}`,
			tarea.estado + (tarea.orden ? ` #${tarea.orden}` : ''),
			tarea.id,
			tarea.pr ? `PR ${tarea.pr}` : '',
			tarea.espera.length ? `espera ${tarea.espera.length}` : '',
			tarea.revisiones.length
				? `revisiones ${tarea.revisiones.map((r) => r.veredicto).join('/')}`
				: '',
			hechos.join('+'),
			notas.length ? `! ${notas.join('; ')}` : '',
		];
		lineas.push(partes.filter(Boolean).join('  '));
	}
	lineas.push(
		'',
		`Tasks: ${resultado.tareas.length} (${[...porEstado].map(([e, n]) => `${e} ${n}`).join(', ')})`,
		`Review tasks folded into their origin: ${resultado.revisionesPlegadas}`,
		...resultado.avisos.map((aviso) => `! ${aviso}`),
		'Dry run: nothing was written.',
	);
	return lineas.join('\n');
}
