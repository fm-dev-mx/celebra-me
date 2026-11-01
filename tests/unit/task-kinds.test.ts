import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts', 'shared', 'task-kinds.mjs')).href;

/** Runs `code` with the task-kinds module imported as `k`; prints JSON. */
function probe(code: string, input: unknown = null) {
	const src = `const k = await import(process.argv[1]); const input = JSON.parse(process.argv[2]); ${code}`;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, MODULE, JSON.stringify(input)],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

describe('task kinds', () => {
	it('has one valid file per tipo, pointing at routing-matrix task types', () => {
		const r = probe(`const { kinds, issues } = k.loadKinds();
			console.log(JSON.stringify({ issues, tipos: Object.keys(kinds),
				lee: Object.values(kinds).flatMap((x) => x.lee), types: k.routingTaskTypes() }));`);
		expect(r.issues).toEqual([]);
		expect(r.tipos).toEqual([
			'codigo',
			'revision',
			'release',
			'invitacion',
			'creativo',
			'auditoria',
			'operacion',
			'operacion-cloudflare',
		]);
		for (const t of r.lee) expect(r.types).toContain(t);
	});

	it('reads only its YAML subset and checks each field', () => {
		const r = probe(
			`const doc = k.parseKind(input.text);
			let bad; try { k.parseKind('tipo: codigo\\n  oops'); } catch (e) { bad = e.message; }
			let orphan; try { k.parseKind('  - suelto'); } catch (e) { orphan = e.message; }
			const issues = k.kindIssues({ ...doc, devuelve: ['pr'], extra: 'x', pasos: ['{otro}'], tras_cierre: 'x' }, 'codigo', ['testing_qa']);
			console.log(JSON.stringify({ doc, bad, orphan, issues }));`,
			{
				text: "# c\ntipo: codigo\ndescripcion: 'It''s'\nlee:\n    - 'testing_qa'\nvacia: []\n",
			},
		);
		expect(r.doc).toEqual({
			tipo: 'codigo',
			descripcion: "It's",
			lee: ['testing_qa'],
			vacia: [],
		});
		expect(r.bad).toContain('línea 2');
		expect(r.orphan).toContain('sin clave');
		expect(r.issues).toEqual(
			expect.arrayContaining([
				'clave desconocida: vacia',
				'clave desconocida: extra',
				'devuelve debe ser [pr, sha, nivel], el contrato de T129',
				'marcador desconocido: {otro}',
				'falta listo_si',
				'tras_cierre debe ser una lista',
			]),
		);
	});
});
