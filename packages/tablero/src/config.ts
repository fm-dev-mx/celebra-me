// Project settings live in `tablero.config.json`; the core never names a project.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface Carril {
	id: string;
	carpeta?: string;
	puerto?: number;
}

export interface Config {
	/** Display name, also the only project text sent in notifications. */
	proyecto: string;
	/** Data directory, relative to the config file. */
	datos: string;
	/** Page port; the server always binds 127.0.0.1. */
	puerto: number;
	wipMax: number;
	hechoDias: number;
	zonaHoraria?: string;
	/** Actors allowed to reorder the queue. */
	ordenan: string[];
	carriles: Carril[];
	tiposPrompt: string[];
	github?: { repo: string };
	/** Names of environment variables, never the secret values themselves. */
	telegram?: { tokenEnv: string; chatEnv: string };
	migracion?: { desde: string };
	/** Absolute directory of the config file; paths above resolve against it. */
	raiz: string;
}

export const ARCHIVO_CONFIG = 'tablero.config.json';

const DEFECTOS = {
	wipMax: 3,
	hechoDias: 7,
	ordenan: ['coordinador'],
	carriles: [],
	tiposPrompt: [],
};

function esTexto(valor: unknown): valor is string {
	return typeof valor === 'string' && valor.trim().length > 0;
}

function esEntero(valor: unknown, min: number, max: number): valor is number {
	return Number.isInteger(valor) && (valor as number) >= min && (valor as number) <= max;
}

function esListaDeTexto(valor: unknown): boolean {
	return Array.isArray(valor) && valor.every(esTexto);
}

function validarBasicos(c: Record<string, unknown>, errores: string[]): void {
	if (!esTexto(c.proyecto)) errores.push('proyecto: required text');
	if (!esTexto(c.datos)) errores.push('datos: required relative path');
	if (!esEntero(c.puerto, 1024, 65535)) errores.push('puerto: integer 1024–65535');
	if (c.wipMax !== undefined && !esEntero(c.wipMax, 1, 50)) errores.push('wipMax: integer 1–50');
	if (c.hechoDias !== undefined && !esEntero(c.hechoDias, 1, 365))
		errores.push('hechoDias: integer 1–365');
	if (c.zonaHoraria === undefined) return;
	try {
		new Intl.DateTimeFormat('en', { timeZone: String(c.zonaHoraria) });
	} catch {
		errores.push('zonaHoraria: unknown IANA time zone');
	}
}

function validarListas(c: Record<string, unknown>, errores: string[]): void {
	if (c.ordenan !== undefined && !esListaDeTexto(c.ordenan))
		errores.push('ordenan: list of actor names');
	if (c.tiposPrompt !== undefined && !esListaDeTexto(c.tiposPrompt))
		errores.push('tiposPrompt: list of names');
	if (c.carriles === undefined) return;
	if (!Array.isArray(c.carriles)) {
		errores.push('carriles: list');
		return;
	}
	c.carriles.forEach((carril: Record<string, unknown>, i) => {
		if (!esTexto(carril?.id)) errores.push(`carriles[${i}].id: required text`);
		if (carril?.puerto !== undefined && !esEntero(carril.puerto, 1024, 65535)) {
			errores.push(`carriles[${i}].puerto: integer 1024–65535`);
		}
	});
}

function validarIntegraciones(c: Record<string, unknown>, errores: string[]): void {
	const github = c.github as Record<string, unknown> | undefined;
	if (github !== undefined && !/^[\w.-]+\/[\w.-]+$/.test(String(github?.repo))) {
		errores.push('github.repo: owner/name');
	}
	const telegram = c.telegram as Record<string, unknown> | undefined;
	if (telegram !== undefined && !(esTexto(telegram?.tokenEnv) && esTexto(telegram?.chatEnv))) {
		errores.push('telegram: tokenEnv and chatEnv name environment variables');
	}
	const migracion = c.migracion as Record<string, unknown> | undefined;
	if (migracion !== undefined && !esTexto(migracion?.desde))
		errores.push('migracion.desde: required path');
	for (const clave of ['datos', 'migracion']) {
		const valor = clave === 'datos' ? c.datos : migracion?.desde;
		if (esTexto(valor) && path.isAbsolute(valor))
			errores.push(`${clave}: use a path relative to the config`);
	}
}

/** Returns a list of problems; an empty list means the config is valid. */
export function validarConfig(datos: unknown): string[] {
	if (!datos || typeof datos !== 'object' || Array.isArray(datos))
		return ['config must be an object'];
	const c = datos as Record<string, unknown>;
	const errores: string[] = [];
	validarBasicos(c, errores);
	validarListas(c, errores);
	validarIntegraciones(c, errores);
	return errores;
}

export function cargarConfig(archivo: string): Config {
	const ruta = path.resolve(archivo);
	if (!existsSync(ruta)) throw new Error(`Config not found: ${ruta}`);
	const datos = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
	const errores = validarConfig(datos);
	if (errores.length > 0)
		throw new Error(`Invalid ${path.basename(ruta)}:\n- ${errores.join('\n- ')}`);
	return { ...DEFECTOS, ...(datos as Omit<Config, 'raiz'>), raiz: path.dirname(ruta) };
}

/** Finds the nearest `tablero.config.json` from `desde` upwards. */
export function buscarConfig(desde: string): string {
	let dir = path.resolve(desde);
	for (;;) {
		const candidato = path.join(dir, ARCHIVO_CONFIG);
		if (existsSync(candidato)) return candidato;
		const padre = path.dirname(dir);
		if (padre === dir) throw new Error(`No ${ARCHIVO_CONFIG} found from ${desde}`);
		dir = padre;
	}
}

export function rutaDatos(config: Config): string {
	return path.resolve(config.raiz, config.datos);
}
