import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tuFormPattern } from '../helpers/tu-register';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/** Extracts quoted string and template literal contents (the visible copy) from a TS source. */
function stringLiterals(source: string): string[] {
	return [...source.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map(
		(match) => match[1] ?? match[2] ?? '',
	);
}

describe('landing copy register', () => {
	it('addresses visitors with "usted" in the landing data', () => {
		const offenders = stringLiterals(read('src/data/landing-page.data.ts')).filter((text) =>
			tuFormPattern.test(text),
		);
		expect(offenders).toEqual([]);
	});

	it('publishes the privacy notice without review placeholders', () => {
		const privacy = read('src/pages/privacidad.astro');
		expect(privacy).not.toContain('[');
		expect(privacy).not.toMatch(/borrador técnico/i);
		expect(privacy).not.toMatch(/nodemailer|gmail/i);
		expect(privacy).toContain('Francisco Mendoza');
		expect(privacy).toContain('Los Mochis, Sinaloa');
		expect(privacy).toContain('contacto@celebra-me.com');
	});
});
