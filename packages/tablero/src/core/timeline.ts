// One projection for every reader: three strips (done, in progress, next), parked tasks and the
// owner inbox. The page, the MCP server and notifications all read this same object.

import { abiertos, resumir, type ItemBandeja, type ResumenBandeja } from './inbox.ts';
import {
	esEsperaDeTarea,
	esperasPendientes,
	estaEstacionada,
	type Espera,
	type Tarea,
} from './model.ts';
import { cola } from './order.ts';
import type { Evento } from './store.ts';

export interface FilaHecho {
	id: string;
	num: number;
	titulo: string;
	pr?: number;
	estado: 'hecho' | 'cancelada';
	/** Log facts after completion, e.g. `merged`, `verified`. */
	hechos: string[];
}

export interface FilaActiva {
	id: string;
	num: number;
	titulo: string;
	estado: 'en curso' | 'en revision';
	agente?: string;
	carril?: string;
	pr?: number;
	desde?: string;
	revision?: string;
}

export interface FilaSiguiente {
	id: string;
	num: number;
	titulo: string;
	/** Visible position in its strip, starting at 1; parked tasks do not count in Siguiente. */
	orden: number;
	/** Human text for what the task waits on, e.g. `T465` or `payment received`. */
	espera: string[];
}

export interface LineaDeTiempo {
	proyecto: string;
	generado: string;
	wipMax: number;
	hecho: { dia: string; tareas: FilaHecho[] }[];
	enCurso: FilaActiva[];
	siguiente: FilaSiguiente[];
	estacionadas: FilaSiguiente[];
	bandeja: ItemBandeja[];
	resumen: ResumenBandeja;
}

export interface OpcionesVista {
	proyecto: string;
	wipMax: number;
	hechoDias: number;
	zonaHoraria?: string;
}

function dia(iso: string, zonaHoraria?: string): string {
	if (!zonaHoraria) return iso.slice(0, 10);
	return new Date(iso).toLocaleDateString('en-CA', { timeZone: zonaHoraria });
}

function textoEspera(espera: Espera, tareas: Map<string, Tarea>): string {
	if (!esEsperaDeTarea(espera)) return espera.externa;
	const num = tareas.get(espera.tarea)?.num;
	return num ? `T${num}` : espera.tarea;
}

export function lineaDeTiempo(
	tareas: Map<string, Tarea>,
	bitacora: readonly Evento[],
	bandeja: readonly ItemBandeja[],
	opciones: OpcionesVista,
	ahora: Date,
): LineaDeTiempo {
	const cierre = new Map<string, string>();
	const hechos = new Map<string, string[]>();
	for (const evento of bitacora) {
		if (!evento.tarea) continue;
		if (evento.evento === 'estado' && (evento.a === 'hecho' || evento.a === 'cancelada')) {
			cierre.set(evento.tarea, evento.en);
		}
		if (evento.evento === 'merged' || evento.evento === 'verified') {
			hechos.set(evento.tarea, [...(hechos.get(evento.tarea) ?? []), evento.evento]);
		}
	}

	const limite = ahora.getTime() - opciones.hechoDias * 86_400_000;
	const porDia = new Map<string, { en: string; fila: FilaHecho }[]>();
	for (const tarea of tareas.values()) {
		if (tarea.estado !== 'hecho' && tarea.estado !== 'cancelada') continue;
		const en = cierre.get(tarea.id) ?? tarea.actualizado;
		if (Date.parse(en) < limite) continue;
		const fila: FilaHecho = {
			id: tarea.id,
			num: tarea.num,
			titulo: tarea.titulo,
			estado: tarea.estado,
			hechos: [...new Set(hechos.get(tarea.id) ?? [])],
		};
		if (tarea.pr) fila.pr = tarea.pr;
		const clave = dia(en, opciones.zonaHoraria);
		porDia.set(clave, [...(porDia.get(clave) ?? []), { en, fila }]);
	}

	const enCurso: FilaActiva[] = [...tareas.values()]
		.filter((tarea) => tarea.estado === 'en curso' || tarea.estado === 'en revision')
		.sort((a, b) => (a.estado === b.estado ? a.num - b.num : a.estado === 'en curso' ? -1 : 1))
		.map((tarea) => {
			const fila: FilaActiva = {
				id: tarea.id,
				num: tarea.num,
				titulo: tarea.titulo,
				estado: tarea.estado as FilaActiva['estado'],
			};
			if (tarea.agente) fila.agente = tarea.agente;
			if (tarea.carril) fila.carril = tarea.carril;
			if (tarea.pr) fila.pr = tarea.pr;
			if (tarea.candado) fila.desde = tarea.candado.desde;
			const revision = tarea.revisiones.at(-1);
			if (revision) fila.revision = revision.veredicto;
			return fila;
		});

	const siguiente: FilaSiguiente[] = [];
	const estacionadas: FilaSiguiente[] = [];
	for (const tarea of cola(tareas.values())) {
		const tira = estaEstacionada(tarea, tareas, ahora) ? estacionadas : siguiente;
		tira.push({
			id: tarea.id,
			num: tarea.num,
			titulo: tarea.titulo,
			orden: tira.length + 1,
			espera: esperasPendientes(tarea, tareas, ahora).map((espera) =>
				textoEspera(espera, tareas),
			),
		});
	}

	return {
		proyecto: opciones.proyecto,
		generado: ahora.toISOString(),
		wipMax: opciones.wipMax,
		hecho: [...porDia.entries()]
			.sort(([a], [b]) => b.localeCompare(a))
			.map(([clave, filas]) => ({
				dia: clave,
				tareas: filas.sort((a, b) => b.en.localeCompare(a.en)).map(({ fila }) => fila),
			})),
		enCurso,
		siguiente,
		estacionadas,
		bandeja: abiertos(bandeja),
		resumen: resumir(bandeja, tareas),
	};
}
