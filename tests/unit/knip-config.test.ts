import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const CONFIG = JSON.parse(readFileSync(path.join(process.cwd(), 'knip.json'), 'utf8')) as {
	ignore?: string[];
	project: string[];
};

describe('knip config', () => {
	it('ignores the untracked agent reports so lint:dead-code measures versioned code only', () => {
		// Jest's testMatch (**/tests/**) otherwise pulls fixture copies saved under .agent/tmp/reports.
		expect(CONFIG.ignore).toEqual(['.agent/tmp/**']);
	});

	it('keeps every versioned source tree in the project', () => {
		for (const glob of [
			'src/**/*.{ts,tsx,astro,mjs,js}',
			'scripts/**/*.{ts,mjs,cjs,js}',
			'tests/**/*.{ts,tsx,mjs}',
		]) {
			expect(CONFIG.project).toContain(glob);
		}
	});
});
