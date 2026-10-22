#!/usr/bin/env node
/**
 * Starts `astro dev` with the read-only operations console at /ops, bound to 127.0.0.1.
 *   pnpm ops:console               # http://127.0.0.1:4330/ops
 *   pnpm ops:console --port 4331
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const astroBin = join(dirname(require.resolve('astro/package.json')), 'bin', 'astro.mjs');

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? '4330' : args[portIndex + 1];
const passthrough =
	portIndex === -1
		? args
		: args.filter((_, index) => index !== portIndex && index !== portIndex + 1);

console.info(`Consola de operaciones (solo lectura): http://127.0.0.1:${port}/ops`);
const child = spawn(
	process.execPath,
	[astroBin, 'dev', '--host', '127.0.0.1', '--port', port, ...passthrough],
	{ stdio: 'inherit', env: { ...process.env, CELEBRA_OPS_CONSOLE: '1' } },
);
child.on('exit', (code) => {
	process.exitCode = code ?? 1;
});
