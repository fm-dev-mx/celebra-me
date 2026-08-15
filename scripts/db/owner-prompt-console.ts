/**
 * Resolve interactive I/O for owner Production confirmation.
 *
 * Prefer a real TTY on stdin/stderr. On Windows VS Code tasks, those handles
 * are often pipes while a console still exists — open CONIN$/CONOUT$ and use
 * those streams for @inquirer so a piped `echo PROMOTE … |` cannot confirm.
 * Opening CONIN$ is not authorization by itself; the prompts must read it.
 */

import { closeSync, createReadStream, createWriteStream, openSync } from 'node:fs';

export type OwnerPromptIoSource = 'tty' | 'win32-console';

export type OwnerPromptIo = {
	input: NodeJS.ReadableStream;
	output: NodeJS.WritableStream;
	source: OwnerPromptIoSource;
};

export type WindowsOwnerConsole = {
	input: NodeJS.ReadableStream;
	output: NodeJS.WritableStream;
};

export type ResolveOwnerPromptIoInput = {
	stdin?: NodeJS.ReadStream;
	stderr?: NodeJS.WriteStream;
	platform?: NodeJS.Platform;
	openWindowsConsole?: () => WindowsOwnerConsole | null;
};

const WIN32_CONIN = '\\\\.\\CONIN$';
const WIN32_CONOUT = '\\\\.\\CONOUT$';

export function openWindowsOwnerConsole(): WindowsOwnerConsole | null {
	let inFd = -1;
	let outFd = -1;
	try {
		inFd = openSync(WIN32_CONIN, 'r');
		outFd = openSync(WIN32_CONOUT, 'w');
		return {
			input: createReadStream('', { fd: inFd, autoClose: true }),
			output: createWriteStream('', { fd: outFd, autoClose: true }),
		};
	} catch {
		if (inFd >= 0) {
			try {
				closeSync(inFd);
			} catch {
				/* already closed or invalid */
			}
		}
		if (outFd >= 0) {
			try {
				closeSync(outFd);
			} catch {
				/* already closed or invalid */
			}
		}
		return null;
	}
}

export function resolveOwnerPromptIo(
	input: ResolveOwnerPromptIoInput = {},
): OwnerPromptIo | null {
	const stdin = input.stdin ?? process.stdin;
	const stderr = input.stderr ?? process.stderr;
	const platform = input.platform ?? process.platform;

	if (stdin.isTTY && stderr.isTTY) {
		return { input: stdin, output: stderr, source: 'tty' };
	}

	if (platform !== 'win32') {
		return null;
	}

	const consoleIo = (input.openWindowsConsole ?? openWindowsOwnerConsole)();
	if (!consoleIo) {
		return null;
	}

	return {
		input: consoleIo.input,
		output: consoleIo.output,
		source: 'win32-console',
	};
}

export function destroyOwnerPromptIo(io: OwnerPromptIo | null | undefined): void {
	if (!io || io.source !== 'win32-console') {
		return;
	}
	io.input.destroy();
	if ('end' in io.output && typeof io.output.end === 'function') {
		io.output.end();
	}
}
