import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'board.mjs');
const VERIFY_PATH = path.join(ROOT, 'scripts', 'board', 'verify-board.mjs');
const MODULE = (name: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', name)).href;
const NOW = '2026-10-24T20:00:00Z';
const BUSCA = 'Que cada tarea tenga tipo.\nTerminado cuando: las pruebas lo fijan.';

type Json = Record<string, unknown>;
const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs `code` with kinds, kind-prompt, prompt and model imported (as k, kp, p, m); prints JSON. */
function probe(code: string, input: unknown = null) {
	const src = `const [k, kp, p, m] = await Promise.all(process.argv.slice(1, 5).map((u) => import(u)));
		const input = JSON.parse(process.argv[5]); ${code}`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			src,
			MODULE('kinds.mjs'),
			MODULE('kind-prompt.mjs'),
			MODULE('prompt.mjs'),
			MODULE('model.mjs'),
			JSON.stringify(input),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

function task(id: string, fields: Json = {}): Json {
	return {
		id,
		titulo: `Tarea ${id}`,
		estado: 'pendiente',
		urgencia: 'normal',
		actor: 'sesion',
		agente: 'claude',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

const TYPED = {
	tipo: 'codigo',
	busca: BUSCA,
	rama: 'feat/board-task-kinds',
	corto: 'Tipos y prompts',
	carrilPlaneado: 'f05-plataforma',
};

function makeBoard(tareas: Json[], decisiones: Json[] = []) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-kinds-'));
	dirs.push(dir);
	writeFileSync(path.join(dir, 'answers.json'), '{}');
	for (const sub of ['tareas', 'decisiones']) mkdirSync(path.join(dir, sub), { recursive: true });
	for (const [index, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: index + 1, ...doc }),
		);
	for (const { id, ...doc } of decisiones)
		writeFileSync(path.join(dir, 'decisiones', `${id}.json`), JSON.stringify(doc));
	return dir;
}

function run(script: string, dir: string, ...args: string[]) {
	const result = runCommand(process.execPath, [script, ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({
			CELEBRA_BOARD_DIR: dir,
			INIT_CWD: ROOT,
			CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
			CLAUDE_CODE_HOST_SESSION_ID: '',
		}),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}
const cli = (dir: string, ...args: string[]) => run(SCRIPT_PATH, dir, ...args);

const readTask = (dir: string, id: string) =>
	JSON.parse(readFileSync(path.join(dir, 'tareas', `${id}.json`), 'utf8'));

describe('task kinds (T130): kind files', () => {
	it('has one valid file per tipo, pointing at routing-matrix task types', () => {
		const r = probe(`const { kinds, issues } = k.loadKinds();
			console.log(JSON.stringify({ issues, tipos: Object.keys(kinds), all: m.TIPOS,
				lee: Object.values(kinds).flatMap((x) => x.lee), types: k.routingTaskTypes() }));`);
		expect(r.issues).toEqual([]);
		// d290: operacion has one variant file per destino besides its base file.
		expect(r.tipos).toEqual([...r.all, 'operacion-cloudflare']);
		expect(r.all).toEqual([
			'codigo',
			'revision',
			'release',
			'invitacion',
			'creativo',
			'auditoria',
			'operacion',
		]);
		for (const t of r.lee) expect(r.types).toContain(t);
		for (const tipo of r.tipos) {
			const lines = readFileSync(path.join(ROOT, '.agent', 'kinds', `${tipo}.yaml`), 'utf8')
				.trimEnd()
				.split('\n');
			expect(lines.length).toBeLessThanOrEqual(30);
		}
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

describe('task kinds (T130): generated prompt', () => {
	const decisiones = [
		{ id: 'd210', decision: 'Nadie reinicia 4320.', vigente: false, tareas: [] },
		{
			id: 'd240',
			decision: 'Solo el coordinador\nreinicia 4320.',
			vigente: true,
			reemplaza: 'd210',
			tareas: [],
		},
		{ id: 'd213', decision: 'Tipos de tarea.', vigente: true, tareas: ['tipos-y-prompts'] },
	];

	it('maps the kind into the prompt-v1 sections, with the linked decisions current text', () => {
		const t = task('tipos-y-prompts', {
			...TYPED,
			num: 130,
			rev: 4,
			decisiones: ['d210'],
			autorizo: ['Leer el tablero.'],
			noHagas: ['No toque view.html.'],
			lee: ['coordinator_board'],
			requisitos: [{ tipo: 'tarea', ref: 'contrato-retorno' }],
		});
		const r = probe(
			`const kind = k.loadKinds().kinds.codigo;
			const prompt = kp.kindPrompt(input.t, input.board, kind, { generado: '${NOW}' });
			console.log(JSON.stringify({ prompt, issues: p.promptV1Issues(prompt), meta: p.promptMetadata(prompt),
				sections: Object.fromEntries(p.PROMPT_SECTIONS.map((s) => [s, p.promptSection(prompt, s).filter(Boolean)])) }));`,
			{
				t,
				board: { tareas: [t, { id: 'contrato-retorno', num: 129 }], decisiones },
			},
		);
		expect(r.issues).toEqual([]);
		expect(r.prompt.split('\n')[0]).toBe('f05 · T130 · Tipos y prompts');
		expect(r.sections['QUÉ SE BUSCA']).toEqual(BUSCA.split('\n'));
		expect(r.sections['ANTES DE EMPEZAR'][0]).toContain(
			'Carril f05-plataforma (carpeta celebra-me-worktrees/f05-plataforma), rama feat/board-task-kinds',
		);
		// d282: the stop compares only this task's own rev, never other tasks' or this session's writes.
		expect(r.sections['ANTES DE EMPEZAR'][0]).toContain(
			'Compruebe que la rev de esta tarea (pnpm board show tipos-y-prompts) sigue en la de «tablero:» de METADATOS; si cambió, pare. Los cambios de otras tareas y los que hace esta misma sesión (claim, set, close, sus commits) no cuentan (d282).',
		);
		expect(r.sections['ANTES DE EMPEZAR'][0]).not.toContain('la rev del tablero');
		expect(r.sections['ANTES DE EMPEZAR'][1]).toContain(
			'commit_preparation, testing_qa, coordinator_board',
		);
		expect(r.sections['ANTES DE EMPEZAR']).toContain(
			'pnpm board claim tipos-y-prompts --agente=claude --rama=feat/board-task-kinds --titulo="f05 · T130 · Tipos y prompts"',
		);
		expect(r.sections.AUTORIZO.at(-1)).toBe('Leer el tablero.');
		expect(r.sections['NO HAGAS'].at(-1)).toBe('- No toque view.html.');
		// d210 was replaced by d240: the prompt carries the current text, on one line.
		expect(r.sections.DECISIONES).toEqual([
			'- d213: Tipos de tarea.',
			'- d240: Solo el coordinador reinicia 4320.',
		]);
		expect(r.sections['PARE Y PREGUNTE SI'].join('\n')).toContain(
			'pnpm board msg tipos-y-prompts --de=claude --para=dueno',
		);
		const closing = r.sections['AL TERMINAR'].join('\n');
		// A kind prompt that pushes a branch carries the pre-push check first.
		expect(r.sections['AL TERMINAR'][0]).toMatch(
			/^- Antes de cada push: pnpm validate:changed .* pnpm validate:structure;/u,
		);
		expect(r.sections['AL TERMINAR'][1]).toMatch(/^- Antes del push: corra \/code-review/u);
		expect(closing).toContain('1. pnpm validate:changed y pnpm type-check en verde.');
		expect(closing).toContain(
			'si imprime «Revisor: subagente» (d288, riesgo bajo o medio), siga sus pasos',
		);
		expect(closing).toContain('--excepcion=… --pr=#<n> --sha=<sha del PR> --nivel=type-check');
		expect(closing).toContain('{"pr":"#<n>","sha":"<sha de 40>","nivel":"type-check"}');
		// d255: `review` refuses a task without its cierre, so the close line comes first.
		const steps = r.sections['AL TERMINAR'];
		const close = steps.findIndex((l: string) =>
			l.includes('pnpm board close tipos-y-prompts'),
		);
		const review = steps.findIndex((l: string) =>
			l.includes('pnpm board review tipos-y-prompts'),
		);
		expect(close).toBeGreaterThan(-1);
		// d290: close already leaves a task with a PR «en revision», so no set step comes between.
		expect(steps.some((l: string) => l.includes('pnpm board set tipos-y-prompts'))).toBe(false);
		expect(review).toBeGreaterThan(close);
		expect(r.meta).toMatchObject({
			formato: 'prompt-v1',
			tarea: 'T130 tipos-y-prompts',
			carril: 'f05-plataforma',
			rama: 'feat/board-task-kinds',
			base: 'develop',
			prerrequisito: 'T129 contrato-retorno',
			decisiones: 'd213, d240',
			tablero: 'rev 4',
		});
	});

	it('names the PR on line 1, refuses what the template lacks and waits for a lane', () => {
		const r = probe(
			`const { kinds } = k.loadKinds();
			const make = (t) => { try { return kp.kindPrompt(t, { decisiones: [] }, kinds[t.tipo], {}); } catch (e) { return 'error: ' + e.message; } };
			console.log(JSON.stringify({
				pr: make({ ...input.t, pr: '#540' })?.split('\\n')[0],
				noRama: make({ ...input.t, rama: undefined }),
				audit: make({ ...input.t, tipo: 'auditoria', rama: undefined })?.split('\\n')[0],
				badDecision: make({ ...input.t, decisiones: ['d999'] }),
				noLane: make({ ...input.t, carrilPlaneado: undefined }),
				review: m.resultKind({ tipo: 'revision' }), code: m.resultKind({ tipo: 'codigo' }),
				legacy: m.resultKind({ pr: '#1' }), other: m.resultKind({ tipo: 'auditoria' }),
			}));`,
			{ t: task('x', { ...TYPED, num: 7 }) },
		);
		expect(r.pr).toBe('f05 · T7 · PR #540 · Tipos y prompts');
		expect(r.noRama).toBe('error: falta rama para el tipo codigo');
		expect(r.audit).toBe('f05 · T7 · Tipos y prompts');
		expect(r.badDecision).toBe('error: decisión inexistente: d999');
		expect(r.noLane).toBeNull();
		expect([r.review, r.code, r.legacy, r.other]).toEqual([
			'revision',
			'codigo',
			'codigo',
			null,
		]);
	});

	it('compares prompts without the keys that change on every write', () => {
		const r =
			probe(`const a = p.buildPrompt({ identidad: 'f05 · T1 · A', secciones: [['QUÉ SE BUSCA', ['x']], ['DECISIONES', ['- d1: a']]],
				metadatos: [['tablero', 'rev 1'], ['generado', '${NOW}']] });
			const b = p.withRunLines(a.replace('rev 1', 'rev 9').replace('${NOW}', 'otra'), ['Corre en: f05']);
			console.log(JSON.stringify({ same: kp.promptDiff(a, b), changed: kp.promptDiff(a, a.replace('d1: a', 'd1: b').replace('T1 · A', 'T1 · B')) }));`);
		expect(r.same).toEqual([]);
		expect(r.changed).toEqual(['nombre', 'DECISIONES']);
	});
});

describe('task kinds (T130): pnpm board', () => {
	it('generates the prompt of a typed task on add, set and plan, and refuses a hand-written one', () => {
		const dir = makeBoard([task('vieja', { prompt: 'T1 · Vieja\nDECISIONES\n- ninguna' })]);
		const base = [
			'add',
			'nueva',
			'titulo=Nueva',
			'urgencia=normal',
			'actor=sesion',
			'agente=codex',
		];
		// Contrato 3: a new session task says what it does.
		expect(cli(dir, ...base, '--coordinador').err).toContain('falta tipo=codigo|');
		expect(cli(dir, ...base, 'tipo=codigo', '--coordinador').err).toContain('busca=');
		expect(
			cli(dir, ...base, 'tipo=auditoria', `busca=${BUSCA}`, 'prompt=hola', '--coordinador')
				.err,
		).toContain('su prompt se genera');
		// A `\n` typed in the shell argument also breaks the line.
		const typed = 'busca=Que funcione.\\nTerminado cuando: pasa.';
		expect(cli(dir, ...base, 'tipo=auditoria', typed, '--coordinador').status).toBe(0);
		// No lane yet: no prompt, so it waits for one.
		expect(readTask(dir, 'nueva')).not.toHaveProperty('prompt');
		expect(
			cli(dir, 'plan', 'nueva', '--rev=1', '--carril=f09-docs', '--coordinador').status,
		).toBe(0);
		const planned = readTask(dir, 'nueva');
		expect(planned.prompt.split('\n')[0]).toBe('f09 · T2 · Nueva');
		expect(planned.prompt).toContain('tablero: rev 2');
		expect(planned.prompt).toContain('\nTerminado cuando: pasa.\n');
		expect(cli(dir, 'set', 'nueva', '--rev=2', 'corto=Corta', '--coordinador').status).toBe(0);
		expect(readTask(dir, 'nueva').prompt.split('\n')[0]).toBe('f09 · T2 · Corta');
		expect(cli(dir, 'set', 'nueva', '--rev=3', 'prompt=x', '--coordinador').err).toContain(
			'su prompt se genera',
		);
		// An open task from before the contract keeps working without tipo.
		expect(cli(dir, 'set', 'vieja', '--rev=1', 'ahora=sigue', '--coordinador').status).toBe(0);
		expect(readTask(dir, 'vieja').prompt).toBe('T1 · Vieja\nDECISIONES\n- ninguna');
		expect(cli(dir, 'prompt', 'vieja').err).toContain('vieja no tiene tipo');
	});

	it('prints the generated prompt, saves it with --guardar and verify flags a stale one', () => {
		const d = { id: 'd213', decision: 'Tipos de tarea.', vigente: true, tareas: ['tipada'] };
		const dir = makeBoard(
			[task('tipada', { ...TYPED, prompt: 'viejo\nDECISIONES\n- x' })],
			[d],
		);
		const shown = cli(dir, 'prompt', 'tipada', '--json');
		expect(shown.status).toBe(0);
		const { prompt, difiere } = JSON.parse(shown.out);
		expect(prompt).toContain('- d213: Tipos de tarea.');
		expect(difiere).toContain('QUÉ SE BUSCA');
		const verify = () => JSON.parse(run(VERIFY_PATH, dir, dir, '--json').out);
		expect(verify().avisos).toContainEqual({
			id: 'tipada',
			msg: expect.stringContaining('el prompt guardado no es el que genera su tipo'),
		});
		expect(cli(dir, 'prompt', 'tipada', '--guardar', '--coordinador').err).toContain(
			'falta --rev',
		);
		const saved = cli(dir, 'prompt', 'tipada', '--guardar', '--rev=1', '--coordinador');
		expect(saved.out).toContain('tipada rev 2: prompt regenerado');
		expect(readTask(dir, 'tipada').prompt).toContain('tablero: rev 2');
		expect(cli(dir, 'prompt', 'tipada', '--guardar', '--rev=2', '--coordinador').out).toContain(
			'ya tiene ese prompt',
		);
		expect(
			verify().avisos.filter((a: Json) => String(a.msg).includes('genera su tipo')),
		).toEqual([]);
		// A replaced decision changes the generated text: verify flags it.
		writeFileSync(
			path.join(dir, 'decisiones', 'd213.json'),
			JSON.stringify({ ...d, id: undefined, decision: 'Tipos de tarea, versión 2.' }),
		);
		expect(verify().avisos).toContainEqual({
			id: 'tipada',
			msg: expect.stringContaining('(DECISIONES)'),
		});
	});
});
