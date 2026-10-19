import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Drops `//` line comments outside strings; wrangler.jsonc uses no block comments. */
function stripLineComments(source: string): string {
	let output = '';
	let inString = false;
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		if (inString) {
			output += char;
			if (char === '\\') output += source[++index] ?? '';
			else if (char === '"') inString = false;
		} else if (char === '"') {
			inString = true;
			output += char;
		} else if (char === '/' && source[index + 1] === '/') {
			while (index < source.length && source[index] !== '\n') index++;
			output += '\n';
		} else {
			output += char;
		}
	}
	return output;
}

/** The repository's wrangler.jsonc, parsed. */
export function readWranglerConfig<T>(): T {
	return JSON.parse(
		stripLineComments(readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')),
	) as T;
}
