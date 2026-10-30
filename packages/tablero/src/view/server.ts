// Local page: three strips plus the owner inbox, refreshed over Server-Sent Events.
// Binds 127.0.0.1 only and rejects requests whose Host or Origin is not that address.

import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TableroError } from '../core/model.ts';
import type { Store } from '../core/store.ts';
import type { Config } from '../config.ts';
import { proyectarLinea } from '../proyeccion.ts';

export const HOST = '127.0.0.1';
const PAGINA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'page.html');
const MAX_CUERPO = 16 * 1024;

export interface Vista {
	servidor: Server;
	cerrar: () => Promise<void>;
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
	res.writeHead(estado, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
	});
	res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let texto = '';
		req.setEncoding('utf8');
		req.on('data', (parte: string) => {
			texto += parte;
			if (texto.length > MAX_CUERPO)
				reject(new TableroError('cuerpo', 'Request body too large'));
		});
		req.on('end', () => resolve(texto));
		req.on('error', reject);
	});
}

export function iniciarVista(store: Store, config: Config, quien = 'dueno'): Promise<Vista> {
	const origen = `http://${HOST}:${config.puerto}`;
	const clientes = new Set<ServerResponse>();
	const pagina = readFileSync(PAGINA, 'utf8');

	const servidor = createServer(async (req, res) => {
		if (req.headers.host !== `${HOST}:${config.puerto}`)
			return responder(res, 421, { error: 'host' });
		const url = new URL(req.url ?? '/', origen);
		try {
			if (req.method === 'GET' && url.pathname === '/') {
				res.writeHead(200, {
					'content-type': 'text/html; charset=utf-8',
					'content-security-policy':
						"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
				});
				return res.end(pagina);
			}
			if (req.method === 'GET' && url.pathname === '/api/tablero') {
				return responder(res, 200, proyectarLinea(store, config));
			}
			if (req.method === 'GET' && url.pathname === '/events') {
				res.writeHead(200, {
					'content-type': 'text/event-stream',
					'cache-control': 'no-store',
					connection: 'keep-alive',
				});
				res.write('retry: 2000\n\n');
				clientes.add(res);
				req.on('close', () => clientes.delete(res));
				return;
			}
			const respuesta = url.pathname.match(/^\/api\/bandeja\/([\w-]+)$/);
			if (req.method === 'POST' && respuesta) {
				if (req.headers.origin !== origen) return responder(res, 403, { error: 'origin' });
				if (!req.headers['content-type']?.startsWith('application/json')) {
					return responder(res, 415, { error: 'content-type' });
				}
				const datos = JSON.parse(await leerCuerpo(req)) as { respuesta?: unknown };
				if (typeof datos.respuesta !== 'string')
					return responder(res, 400, { error: 'respuesta' });
				return responder(
					res,
					200,
					store.responderBandeja(respuesta[1]!, datos.respuesta, quien),
				);
			}
			responder(res, 404, { error: 'not found' });
		} catch (error) {
			const codigo =
				error instanceof TableroError || error instanceof SyntaxError ? 400 : 500;
			responder(res, codigo, { error: (error as Error).message });
		}
	});

	let espera: NodeJS.Timeout | undefined;
	const avisar = () => {
		clearTimeout(espera);
		espera = setTimeout(() => {
			for (const cliente of clientes) cliente.write('event: cambio\ndata: {}\n\n');
		}, 150);
	};
	const vigilante: FSWatcher = watch(store.dir, { recursive: true }, (_evento, nombre) => {
		if (nombre && !String(nombre).endsWith('.lock') && !String(nombre).endsWith('.tmp'))
			avisar();
	});
	const latido = setInterval(() => {
		for (const cliente of clientes) cliente.write(': ping\n\n');
	}, 25_000);

	return new Promise((resolve, reject) => {
		servidor.once('error', reject);
		servidor.listen(config.puerto, HOST, () =>
			resolve({
				servidor,
				cerrar: () =>
					new Promise<void>((fin) => {
						clearInterval(latido);
						clearTimeout(espera);
						vigilante.close();
						for (const cliente of clientes) cliente.end();
						servidor.close(() => fin());
					}),
			}),
		);
	});
}
