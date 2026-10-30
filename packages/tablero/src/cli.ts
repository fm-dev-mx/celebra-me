#!/usr/bin/env node
// Command line entry: `node src/cli.ts <command> [--option=value]`.
// The config is the nearest `tablero.config.json`, or the one given with `--config=<path>`.

import path from 'node:path';
import { buscarConfig, cargarConfig, rutaDatos, type Config } from './config.ts';
import { TIPOS_BANDEJA, type TipoBandeja } from './core/inbox.ts';
import { ESTADOS, TableroError, type Espera, type Estado } from './core/model.ts';
import { Store } from './core/store.ts';
import { informe, leerLegado, migrar } from './migrar.ts';
import { proyectarLinea } from './proyeccion.ts';
import { iniciarMcp } from './mcp/server.ts';
import { HOST, iniciarVista } from './view/server.ts';
import { mensajeBandeja, Telegram } from './adapters/telegram.ts';

const AYUDA = `Usage: tablero <command> [--config=<file>] [options]

  serve                         page with SSE on 127.0.0.1:<puerto>
  mcp                           read-only MCP server on stdio
  timeline [--json]             done / in progress / next
  add --id= --num= --titulo= [--aviso=] [--despues-de=<id>] [--espera=<text>] [--dueno]
  move <id> --a=<estado> --quien= [--pr=<n>] [--rama=] [--rev=<n>]
  order <id> --posicion=<n> --quien=
  review <id> --sha= --revisor= --veredicto=aprobada|cambios [--hallazgo=…]
  fact <id> --hecho=merged|verified --quien=
  inbox add <id> --tipo=decidir|aprobar|hacer --texto= [--opcion=… …] [--url=]
  inbox answer <rowId> --respuesta= [--quien=]
  inbox sync                    open "do outside" rows for owner waits that are due
  notify [--print]              send the inbox summary (counts and public titles only)
  migrate --dry-run [--from=<dir>]`;

type Opciones = Record<string, string[]>;

export function analizar(argv: readonly string[]): { posicionales: string[]; opciones: Opciones } {
	const posicionales: string[] = [];
	const opciones: Opciones = {};
	for (const arg of argv) {
		const coincide = arg.match(/^--([\w-]+)(?:=(.*))?$/s);
		if (!coincide) posicionales.push(arg);
		else (opciones[coincide[1]!] ??= []).push(coincide[2] ?? 'true');
	}
	return { posicionales, opciones };
}

function una(opciones: Opciones, clave: string, requerida = true): string | undefined {
	const valor = opciones[clave]?.at(-1);
	if (requerida && !valor) throw new TableroError('uso', `Missing --${clave}`);
	return valor;
}

function entero(valor: string | undefined): number | undefined {
	if (valor === undefined) return undefined;
	const n = Number(valor);
	if (!Number.isInteger(n)) throw new TableroError('uso', `Not an integer: ${valor}`);
	return n;
}

function abrir(opciones: Opciones): { config: Config; store: Store } {
	const config = cargarConfig(una(opciones, 'config', false) ?? buscarConfig(process.cwd()));
	const store = new Store({
		dir: rutaDatos(config),
		wipMax: config.wipMax,
		ordenan: config.ordenan,
	});
	return { config, store };
}

function imprimir(datos: unknown): void {
	process.stdout.write(`${typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2)}\n`);
}

interface Contexto {
	config: Config;
	store: Store;
	id: string;
	resto: string[];
	opciones: Opciones;
}

function textoLinea({ store, config, opciones }: Contexto): unknown {
	const linea = proyectarLinea(store, config);
	if (opciones.json) return linea;
	const filas = (titulo: string, tareas: { num: number; titulo: string }[]) =>
		[
			`${titulo}:`,
			...tareas.map(
				(t, i) => `  ${titulo === 'Siguiente' ? `${i + 1}. ` : ''}T${t.num} ${t.titulo}`,
			),
		].join('\n');
	return [
		filas(
			'Hecho',
			linea.hecho.flatMap((grupo) => grupo.tareas),
		),
		filas('En curso', linea.enCurso),
		filas('Siguiente', linea.siguiente),
		filas('Estacionadas', linea.estacionadas),
		`Bandeja: ${linea.resumen.decidir} decidir, ${linea.resumen.aprobar} aprobar, ${linea.resumen.hacer} hacer fuera`,
	].join('\n');
}

function agregar({ store, opciones }: Contexto): unknown {
	const espera: Espera[] = [
		...(opciones['despues-de'] ?? []).map((tarea) => ({ tarea })),
		...(opciones.espera ?? []).map((externa) => ({
			externa,
			...(opciones.dueno ? { dueno: true } : {}),
		})),
	];
	const datos = {
		id: una(opciones, 'id')!,
		num: entero(una(opciones, 'num'))!,
		titulo: una(opciones, 'titulo')!,
		espera,
		...(opciones.aviso ? { aviso: una(opciones, 'aviso')! } : {}),
	};
	return store.crear(datos, una(opciones, 'quien', false) ?? 'cli');
}

function mover({ store, id, opciones }: Contexto): unknown {
	const a = una(opciones, 'a') as Estado;
	if (!ESTADOS.includes(a))
		throw new TableroError('uso', `--a must be one of: ${ESTADOS.join(', ')}`);
	const cambio = { a, quien: una(opciones, 'quien')! } as Parameters<Store['mover']>[1];
	const pr = entero(una(opciones, 'pr', false));
	if (pr) cambio.pr = pr;
	const rama = una(opciones, 'rama', false);
	if (rama) cambio.rama = rama;
	return store.mover(id, cambio, entero(una(opciones, 'rev', false)));
}

function revisar({ store, id, opciones }: Contexto): unknown {
	const veredicto = una(opciones, 'veredicto') as 'aprobada' | 'cambios';
	const revision = {
		sha: una(opciones, 'sha')!,
		revisor: una(opciones, 'revisor')!,
		veredicto,
		hallazgos: opciones.hallazgo ?? [],
	};
	return store.revisar(id, revision, una(opciones, 'quien', false) ?? revision.revisor);
}

function hecho({ store, id, opciones }: Contexto): unknown {
	const valor = una(opciones, 'hecho');
	if (valor !== 'merged' && valor !== 'verified')
		throw new TableroError('uso', '--hecho must be merged or verified');
	store.hecho(id, valor, una(opciones, 'quien')!);
	return `${id}: ${valor}`;
}

function bandeja({ store, resto, opciones }: Contexto): unknown {
	const [accion, objetivo] = resto;
	if (accion === 'add') {
		const tipo = una(opciones, 'tipo') as TipoBandeja;
		if (!TIPOS_BANDEJA.includes(tipo))
			throw new TableroError('uso', `--tipo must be one of: ${TIPOS_BANDEJA.join(', ')}`);
		const nuevo = { tipo, tarea: objetivo ?? '', texto: una(opciones, 'texto')! } as Parameters<
			Store['agregarBandeja']
		>[0];
		if (opciones.opcion) nuevo.opciones = opciones.opcion;
		const url = una(opciones, 'url', false);
		if (url) nuevo.url = url;
		return store.agregarBandeja(nuevo, una(opciones, 'quien', false) ?? 'cli');
	}
	if (accion === 'answer') {
		return store.responderBandeja(
			objetivo ?? '',
			una(opciones, 'respuesta')!,
			una(opciones, 'quien', false) ?? 'dueno',
		);
	}
	if (accion === 'sync') return store.sincronizarEsperas(una(opciones, 'quien', false) ?? 'cli');
	throw new TableroError('uso', 'inbox add | answer | sync');
}

async function notificar({ store, config, opciones }: Contexto): Promise<unknown> {
	const mensaje = mensajeBandeja(config.proyecto, proyectarLinea(store, config).resumen);
	if (opciones.print || !config.telegram) return mensaje || '(nothing to report)';
	const telegram = Telegram.desdeEntorno(config.telegram);
	if (!telegram)
		throw new TableroError(
			'telegram',
			`Set ${config.telegram.tokenEnv} and ${config.telegram.chatEnv}`,
		);
	await telegram.enviar(mensaje);
	return mensaje ? 'Sent.' : '(nothing to report)';
}

const COMANDOS: Record<string, (contexto: Contexto) => unknown> = {
	serve: async ({ store, config }) => {
		store.sincronizarEsperas('tablero');
		await iniciarVista(store, config);
		return `Board at http://${HOST}:${config.puerto}`;
	},
	timeline: textoLinea,
	add: agregar,
	move: mover,
	order: ({ store, id, opciones }) =>
		store.colocar(id, entero(una(opciones, 'posicion'))!, una(opciones, 'quien')!),
	review: revisar,
	fact: hecho,
	inbox: bandeja,
	notify: notificar,
};

function migrarEnSeco(opciones: Opciones): string {
	if (!opciones['dry-run'])
		throw new TableroError(
			'uso',
			'Only --dry-run exists; the real migration is a separate step.',
		);
	const config = cargarConfig(una(opciones, 'config', false) ?? buscarConfig(process.cwd()));
	const desde = una(opciones, 'from', false) ?? config.migracion?.desde;
	if (!desde) throw new TableroError('uso', 'Set migracion.desde in the config or pass --from');
	return informe(migrar(leerLegado(path.resolve(config.raiz, desde))));
}

async function ejecutar(argv: readonly string[]): Promise<void> {
	const { posicionales, opciones } = analizar(argv);
	const [comando, ...resto] = posicionales;
	if (!comando || comando === 'help' || opciones.help) return imprimir(AYUDA);
	if (comando === 'migrate') return imprimir(migrarEnSeco(opciones));
	if (comando === 'mcp') {
		const { config, store } = abrir(opciones);
		return iniciarMcp(store, config);
	}
	const accion = COMANDOS[comando];
	if (!accion) throw new TableroError('uso', `Unknown command: ${comando}\n\n${AYUDA}`);
	const { config, store } = abrir(opciones);
	imprimir(await accion({ config, store, id: resto[0] ?? '', resto, opciones }));
}

ejecutar(process.argv.slice(2)).catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
