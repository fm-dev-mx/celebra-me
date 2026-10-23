/** Read-only local server for the board view: the page, the shared model and the board as JSON. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBoard } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = {
	'/': ['view.html', 'text/html; charset=utf-8'],
	'/model.mjs': ['model.mjs', 'text/javascript; charset=utf-8'],
};

export function serveView(dir, port) {
	const server = createServer((req, res) => {
		const path = new URL(req.url ?? '/', 'http://localhost').pathname;
		if (req.method !== 'GET') {
			res.writeHead(405).end();
			return;
		}
		if (path === '/api/board') {
			res.writeHead(200, {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			});
			res.end(JSON.stringify(loadBoard(dir)));
			return;
		}
		const f = FILES[path];
		if (!f) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' });
		res.end(readFileSync(join(here, f[0])));
	});
	return new Promise((ok, fail) => {
		server.once('error', fail);
		server.listen(port, '127.0.0.1', () => ok(server));
	});
}
