// Minimal read-only MCP server over stdio (newline-delimited JSON-RPC 2.0).
// Agents read the same projection the page shows; writes stay in the CLI.

import { createInterface } from 'node:readline';
import { abiertos } from '../core/inbox.ts';
import type { Store } from '../core/store.ts';
import type { Config } from '../config.ts';
import { proyectarLinea } from '../proyeccion.ts';

interface Peticion {
	jsonrpc: '2.0';
	id?: number | string | null;
	method: string;
	params?: Record<string, unknown>;
}

const HERRAMIENTAS = [
	{
		name: 'timeline',
		description: 'Done (recent days), in progress and the ordered queue, plus parked tasks.',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'show',
		description: 'One task with its waits, reviews and decisions.',
		inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
	},
	{
		name: 'inbox',
		description: 'Open owner inbox rows (decide, approve, do outside).',
		inputSchema: { type: 'object', properties: {} },
	},
];

export function atender(peticion: Peticion, store: Store, config: Config): unknown {
	switch (peticion.method) {
		case 'initialize':
			return {
				protocolVersion: '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: { name: 'tablero', version: '0.1.0' },
			};
		case 'ping':
			return {};
		case 'tools/list':
			return { tools: HERRAMIENTAS };
		case 'tools/call': {
			const nombre = peticion.params?.name;
			const args = (peticion.params?.arguments ?? {}) as Record<string, unknown>;
			let datos: unknown;
			if (nombre === 'timeline') datos = proyectarLinea(store, config);
			else if (nombre === 'show') datos = store.tarea(String(args.id));
			else if (nombre === 'inbox') datos = abiertos(store.bandeja());
			else throw new Error(`Unknown tool: ${String(nombre)}`);
			return { content: [{ type: 'text', text: JSON.stringify(datos, null, 2) }] };
		}
		default:
			throw Object.assign(new Error(`Method not found: ${peticion.method}`), { rpc: -32601 });
	}
}

export function iniciarMcp(store: Store, config: Config): void {
	const lineas = createInterface({ input: process.stdin });
	const enviar = (mensaje: unknown) => process.stdout.write(`${JSON.stringify(mensaje)}\n`);
	lineas.on('line', (linea) => {
		if (!linea.trim()) return;
		let peticion: Peticion;
		try {
			peticion = JSON.parse(linea) as Peticion;
		} catch {
			return enviar({
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Parse error' },
			});
		}
		if (peticion.id === undefined) return; // notifications need no answer
		try {
			enviar({ jsonrpc: '2.0', id: peticion.id, result: atender(peticion, store, config) });
		} catch (error) {
			const rpc = (error as { rpc?: number }).rpc;
			if (rpc)
				enviar({
					jsonrpc: '2.0',
					id: peticion.id,
					error: { code: rpc, message: (error as Error).message },
				});
			else
				enviar({
					jsonrpc: '2.0',
					id: peticion.id,
					result: {
						isError: true,
						content: [{ type: 'text', text: (error as Error).message }],
					},
				});
		}
	});
}
