// JSON store: one file per task, one inbox file, and an append-only JSONL log per day.
//
// <dir>/tareas/<id>.json · <dir>/bandeja.json · <dir>/bitacora/<YYYY-MM-DD>.jsonl
// Every mutation runs under a lock file so the page server, the CLI and the MCP server can share
// one data directory.

import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
	appendFileSync,
} from 'node:fs';
import path from 'node:path';
import {
	agregar,
	aplicarRespuesta,
	esperasDelDueno,
	resolver,
	type ItemBandeja,
	type NuevoItem,
} from './inbox.ts';
import {
	crearTarea,
	esId,
	estaEstacionada,
	registrarRevision,
	TableroError,
	transitar,
	validarEspera,
	type NuevaTarea,
	type Revision,
	type Tarea,
	type Transicion,
} from './model.ts';
import { alFinal, cola, colocar, normalizar } from './order.ts';

export type TipoEvento =
	| 'creada'
	| 'editada'
	| 'estado'
	| 'orden'
	| 'revision'
	| 'merged'
	| 'verified'
	| 'bandeja'
	| 'respuesta';

export interface Evento {
	en: string;
	quien: string;
	evento: TipoEvento;
	tarea?: string;
	de?: string;
	a?: string;
	datos?: Record<string, unknown>;
}

export interface OpcionesStore {
	dir: string;
	wipMax: number;
	/** Actors allowed to reorder the queue. */
	ordenan: string[];
	reloj?: () => Date;
}

export type CambiosTarea = Partial<
	Pick<Tarea, 'titulo' | 'aviso' | 'espera' | 'carril' | 'agente' | 'tipoPrompt' | 'prompt'>
>;

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

function dormir(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function escribirJson(file: string, value: unknown): void {
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(value, null, '\t')}\n`);
	renameSync(tmp, file);
}

export class Store {
	readonly dir: string;
	private readonly opciones: OpcionesStore;

	constructor(opciones: OpcionesStore) {
		this.opciones = opciones;
		this.dir = path.resolve(opciones.dir);
		mkdirSync(path.join(this.dir, 'tareas'), { recursive: true });
		mkdirSync(path.join(this.dir, 'bitacora'), { recursive: true });
	}

	private ahora(): Date {
		return this.opciones.reloj?.() ?? new Date();
	}

	private archivoTarea(id: string): string {
		if (!esId(id)) throw new TableroError('id', `Invalid task id: ${id}`);
		return path.join(this.dir, 'tareas', `${id}.json`);
	}

	private conCandado<T>(fn: () => T): T {
		const lock = path.join(this.dir, '.lock');
		const limite = Date.now() + LOCK_TIMEOUT_MS;
		for (;;) {
			try {
				closeSync(openSync(lock, 'wx'));
				break;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
				const desde = statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now();
				if (Date.now() - desde > LOCK_STALE_MS) {
					rmSync(lock, { force: true });
				} else if (Date.now() > limite) {
					throw new TableroError('lock', `The board is busy (${lock})`);
				} else {
					dormir(25);
				}
			}
		}
		try {
			return fn();
		} finally {
			rmSync(lock, { force: true });
		}
	}

	tareas(): Map<string, Tarea> {
		const mapa = new Map<string, Tarea>();
		for (const nombre of readdirSync(path.join(this.dir, 'tareas'))) {
			if (!nombre.endsWith('.json')) continue;
			const tarea = JSON.parse(
				readFileSync(path.join(this.dir, 'tareas', nombre), 'utf8'),
			) as Tarea;
			mapa.set(tarea.id, tarea);
		}
		return mapa;
	}

	tarea(id: string): Tarea {
		const file = this.archivoTarea(id);
		if (!existsSync(file)) throw new TableroError('id', `Unknown task: ${id}`);
		return JSON.parse(readFileSync(file, 'utf8')) as Tarea;
	}

	bandeja(): ItemBandeja[] {
		const file = path.join(this.dir, 'bandeja.json');
		return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ItemBandeja[]) : [];
	}

	/** Log events from `desde` (inclusive day) onwards, oldest first. */
	bitacora(desde?: Date): Evento[] {
		const primerDia = desde?.toISOString().slice(0, 10) ?? '';
		const eventos: Evento[] = [];
		for (const nombre of readdirSync(path.join(this.dir, 'bitacora')).sort()) {
			if (!nombre.endsWith('.jsonl') || nombre.slice(0, 10) < primerDia) continue;
			for (const linea of readFileSync(path.join(this.dir, 'bitacora', nombre), 'utf8').split(
				'\n',
			)) {
				if (linea.trim()) eventos.push(JSON.parse(linea) as Evento);
			}
		}
		return eventos;
	}

	private registrar(evento: Omit<Evento, 'en'>): void {
		const en = this.ahora().toISOString();
		const file = path.join(this.dir, 'bitacora', `${en.slice(0, 10)}.jsonl`);
		appendFileSync(file, `${JSON.stringify({ en, ...evento })}\n`);
	}

	/** Writes changed tasks, bumping `rev` only when the content really changed. */
	private guardar(tareas: Tarea[]): void {
		const en = this.ahora().toISOString();
		const ultimas = new Map(tareas.map((tarea) => [tarea.id, tarea]));
		for (const tarea of ultimas.values()) {
			const file = this.archivoTarea(tarea.id);
			const previa = existsSync(file)
				? (JSON.parse(readFileSync(file, 'utf8')) as Tarea)
				: undefined;
			if (previa && JSON.stringify(previa) === JSON.stringify(tarea)) continue;
			escribirJson(file, { ...tarea, rev: (previa?.rev ?? 0) + 1, actualizado: en });
		}
	}

	private comprobarRev(tarea: Tarea, rev?: number): void {
		if (rev !== undefined && tarea.rev !== rev) {
			throw new TableroError('rev', `${tarea.id} is at rev ${tarea.rev}, not ${rev}`);
		}
	}

	crear(datos: NuevaTarea, quien: string): Tarea {
		return this.conCandado(() => {
			const tareas = this.tareas();
			if (tareas.has(datos.id)) throw new TableroError('id', `${datos.id} already exists`);
			if ([...tareas.values()].some((tarea) => tarea.num === datos.num)) {
				throw new TableroError('num', `T${datos.num} already exists`);
			}
			const tarea = {
				...crearTarea(datos, this.ahora()),
				orden: alFinal(tareas.values()),
				rev: 0,
			};
			this.guardar([tarea]);
			this.registrar({ quien, evento: 'creada', tarea: tarea.id, a: 'siguiente' });
			return this.tarea(tarea.id);
		});
	}

	editar(id: string, cambios: CambiosTarea, quien: string, rev?: number): Tarea {
		return this.conCandado(() => {
			const tarea = this.tarea(id);
			this.comprobarRev(tarea, rev);
			const nueva: Tarea = { ...tarea };
			for (const [clave, valor] of Object.entries(cambios) as [
				keyof CambiosTarea,
				unknown,
			][]) {
				if (valor === undefined) continue;
				if (clave === 'espera')
					nueva.espera = (valor as Tarea['espera']).map(validarEspera);
				else if (valor === '' && clave !== 'titulo') delete nueva[clave];
				else (nueva as unknown as Record<string, unknown>)[clave] = valor;
			}
			if (!nueva.titulo.trim()) throw new TableroError('titulo', 'A task needs a title');
			this.guardar([nueva]);
			this.registrar({
				quien,
				evento: 'editada',
				tarea: id,
				datos: { campos: Object.keys(cambios) },
			});
			return this.tarea(id);
		});
	}

	/** Changes state, enforcing the WIP limit on start, then renumbers the queue. */
	mover(id: string, cambio: Transicion, rev?: number): Tarea {
		return this.conCandado(() => {
			const tareas = this.tareas();
			const tarea = tareas.get(id);
			if (!tarea) throw new TableroError('id', `Unknown task: ${id}`);
			this.comprobarRev(tarea, rev);
			if (cambio.a === 'en curso' && tarea.estado !== 'en curso') {
				const enCurso = [...tareas.values()].filter((t) => t.estado === 'en curso').length;
				if (enCurso >= this.opciones.wipMax) {
					throw new TableroError(
						'wip',
						`Already ${enCurso} tasks in progress (limit ${this.opciones.wipMax})`,
					);
				}
			}
			const nueva = transitar(tarea, cambio, tareas, this.ahora());
			if (nueva.estado === 'siguiente') nueva.orden = alFinal(tareas.values());
			tareas.set(id, nueva);
			this.guardar([nueva, ...normalizar(tareas.values())]);
			this.registrar({
				quien: cambio.quien,
				evento: 'estado',
				tarea: id,
				de: tarea.estado,
				a: nueva.estado,
			});
			return this.tarea(id);
		});
	}

	/** `posicion` counts the visible Siguiente strip, as the page numbers it; parked tasks are skipped. */
	colocar(id: string, posicion: number, quien: string): Tarea {
		if (!this.opciones.ordenan.includes(quien)) {
			throw new TableroError('orden', `${quien} may not reorder the queue`);
		}
		return this.conCandado(() => {
			const tareas = this.tareas();
			const de = tareas.get(id)?.orden;
			const ahora = this.ahora();
			const resto = cola(tareas.values()).filter((t) => t.id !== id);
			const objetivo = resto.filter((t) => !estaEstacionada(t, tareas, ahora))[posicion - 1];
			const destino =
				!Number.isInteger(posicion) || posicion < 1
					? posicion
					: objetivo
						? resto.indexOf(objetivo) + 1
						: resto.length + 1;
			this.guardar(colocar(tareas.values(), id, destino));
			this.registrar({
				quien,
				evento: 'orden',
				tarea: id,
				de: String(de ?? ''),
				a: String(posicion),
			});
			return this.tarea(id);
		});
	}

	revisar(id: string, revision: Omit<Revision, 'en'>, quien: string): Tarea {
		return this.conCandado(() => {
			const tarea = registrarRevision(this.tarea(id), revision, this.ahora());
			this.guardar([tarea]);
			this.registrar({
				quien,
				evento: 'revision',
				tarea: id,
				datos: {
					sha: revision.sha,
					revisor: revision.revisor,
					veredicto: revision.veredicto,
				},
			});
			return this.tarea(id);
		});
	}

	/** Merges and verifications are facts in the log, not states. */
	hecho(
		id: string,
		evento: 'merged' | 'verified',
		quien: string,
		datos?: Record<string, unknown>,
	): void {
		this.tarea(id);
		this.conCandado(() => this.registrar({ quien, evento, tarea: id, datos }));
	}

	agregarBandeja(nuevo: NuevoItem, quien: string): ItemBandeja {
		return this.conCandado(() => {
			this.tarea(nuevo.tarea);
			const { items, item, creado } = agregar(this.bandeja(), nuevo, this.ahora());
			if (creado) {
				escribirJson(path.join(this.dir, 'bandeja.json'), items);
				this.registrar({
					quien,
					evento: 'bandeja',
					tarea: item.tarea,
					a: item.tipo,
					datos: { id: item.id },
				});
			}
			return item;
		});
	}

	responderBandeja(id: string, respuesta: string, quien: string): ItemBandeja {
		return this.conCandado(() => {
			const { items, item } = resolver(this.bandeja(), id, respuesta, quien, this.ahora());
			const tarea = this.tarea(item.tarea);
			this.guardar([aplicarRespuesta(tarea, item)]);
			escribirJson(path.join(this.dir, 'bandeja.json'), items);
			this.registrar({
				quien,
				evento: 'respuesta',
				tarea: item.tarea,
				a: respuesta,
				datos: { id, tipo: item.tipo },
			});
			return item;
		});
	}

	/** Opens `hacer` rows for owner waits that became actionable; safe to call repeatedly. */
	sincronizarEsperas(quien: string): ItemBandeja[] {
		const nuevos = esperasDelDueno(this.tareas().values(), this.bandeja(), this.ahora());
		return nuevos.map((nuevo) => this.agregarBandeja(nuevo, quien));
	}
}
