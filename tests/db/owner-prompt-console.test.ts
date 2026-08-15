import { describe, expect, it, jest } from '@jest/globals';
import { PassThrough } from 'node:stream';
import {
	destroyOwnerPromptIo,
	resolveOwnerPromptIo,
	type WindowsOwnerConsole,
} from '../../scripts/db/owner-prompt-console.ts';

function ttyStream(isTTY: boolean): NodeJS.ReadStream {
	return { isTTY } as NodeJS.ReadStream;
}

function writableTty(isTTY: boolean): NodeJS.WriteStream {
	return { isTTY } as NodeJS.WriteStream;
}

function fakeConsole(): WindowsOwnerConsole {
	return {
		input: new PassThrough(),
		output: new PassThrough(),
	};
}

describe('resolveOwnerPromptIo', () => {
	it('uses stdin/stderr when both are TTYs and does not open a Windows console', () => {
		const stdin = ttyStream(true);
		const stderr = writableTty(true);
		let opened = 0;
		const io = resolveOwnerPromptIo({
			stdin,
			stderr,
			platform: 'win32',
			openWindowsConsole: () => {
				opened += 1;
				return fakeConsole();
			},
		});
		expect(io).toEqual({ input: stdin, output: stderr, source: 'tty' });
		expect(opened).toBe(0);
	});

	it('returns null on non-Windows when stdin is a pipe', () => {
		expect(
			resolveOwnerPromptIo({
				stdin: ttyStream(false),
				stderr: writableTty(true),
				platform: 'linux',
				openWindowsConsole: () => fakeConsole(),
			}),
		).toBeNull();
	});

	it('does not treat CONIN$ as sufficient while still reading the pipe', () => {
		const stdin = ttyStream(false);
		const stderr = writableTty(false);
		const consoleIo = fakeConsole();
		const io = resolveOwnerPromptIo({
			stdin,
			stderr,
			platform: 'win32',
			openWindowsConsole: () => consoleIo,
		});
		expect(io?.source).toBe('win32-console');
		expect(io?.input).toBe(consoleIo.input);
		expect(io?.output).toBe(consoleIo.output);
		expect(io?.input).not.toBe(stdin);
		expect(io?.output).not.toBe(stderr);
	});

	it('returns null when Windows has no console to attach', () => {
		expect(
			resolveOwnerPromptIo({
				stdin: ttyStream(false),
				stderr: writableTty(false),
				platform: 'win32',
				openWindowsConsole: () => null,
			}),
		).toBeNull();
	});

	it('destroys only Windows console streams', () => {
		const stdin = ttyStream(true);
		const stderr = writableTty(true);
		const ttyIo = resolveOwnerPromptIo({ stdin, stderr, platform: 'linux' });
		expect(() => destroyOwnerPromptIo(ttyIo)).not.toThrow();

		const consoleIo = fakeConsole();
		const input = consoleIo.input as NodeJS.ReadableStream & { destroy: () => void };
		const output = consoleIo.output as NodeJS.WritableStream & { end: () => void };
		const inputDestroy = jest.spyOn(input, 'destroy');
		const outputEnd = jest.spyOn(output, 'end');
		destroyOwnerPromptIo({
			...consoleIo,
			source: 'win32-console',
		});
		expect(inputDestroy).toHaveBeenCalled();
		expect(outputEnd).toHaveBeenCalled();
	});
});
