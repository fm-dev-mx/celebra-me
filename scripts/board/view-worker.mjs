/**
 * One generation of the board view, started by `view-supervisor.mjs` as a cluster worker. It serves
 * until the supervisor sends `drain` (a newer worker already listens on the same port), then ends its
 * live streams so the page reconnects to the new worker, and exits once its last request is answered.
 */
import { viewArchiver } from './board.mjs';
import { boardDir } from './store.mjs';
import { serveView } from './view-server.mjs';

const dir = boardDir();
try {
	const server = await serveView(dir, Number(process.env.BOARD_VIEW_PORT), {
		archive: viewArchiver(dir),
		token: process.env.BOARD_VIEW_TOKEN,
		version: process.env.BOARD_VIEW_VERSION,
	});
	process.on('message', (message) => {
		if (message !== 'drain') return;
		server.once('close', () => process.exit(0));
		server.drain();
	});
} catch (e) {
	console.error(`El tablero no arrancó: ${e.message ?? e}`);
	process.exit(1);
}
