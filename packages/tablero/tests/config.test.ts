/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validarConfig } from '../src/config.ts';

const ejemplo = JSON.parse(
	readFileSync(path.resolve(__dirname, '..', 'tablero.config.example.json'), 'utf8'),
) as Record<string, unknown>;

describe('config', () => {
	it('accepts the example and a minimal config', () => {
		expect(validarConfig(ejemplo)).toEqual([]);
		expect(validarConfig({ proyecto: 'x', datos: 'datos', puerto: 5000 })).toEqual([]);
	});

	it('reports every problem', () => {
		expect(validarConfig([])).toEqual(['config must be an object']);
		expect(
			validarConfig({
				...ejemplo,
				puerto: 80,
				wipMax: 0,
				zonaHoraria: 'Luna/Base',
				github: { repo: 'sin-barra' },
				telegram: { tokenEnv: 'T' },
			}),
		).toEqual([
			'puerto: integer 1024–65535',
			'wipMax: integer 1–50',
			'zonaHoraria: unknown IANA time zone',
			'github.repo: owner/name',
			'telegram: tokenEnv and chatEnv name environment variables',
		]);
	});

	it('requires paths relative to the config file', () => {
		const absoluta = path.resolve('datos');
		expect(
			validarConfig({ ...ejemplo, datos: absoluta, migracion: { desde: absoluta } }),
		).toEqual([
			'datos: use a path relative to the config',
			'migracion: use a path relative to the config',
		]);
	});
});
