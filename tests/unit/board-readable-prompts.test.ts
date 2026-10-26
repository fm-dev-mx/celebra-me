import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const SHA = 'e'.repeat(40);
const KINDS = [
	'codigo',
	'revision',
	'release',
	'invitacion',
	'creativo',
	'auditoria',
	'operacion',
	'operacion-cloudflare',
];

type Json = Record<string, unknown>;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs `body` with `p` (prompt.mjs), `m` (model.mjs), `k` (kinds.mjs) and `kp` (kind-prompt.mjs) loaded. */
function probe(body: string, input: unknown = null) {
	const href = (f: string) => pathToFileURL(path.join(BOARD, f)).href;
	const script = String.raw`
		const [p, m, k, kp] = await Promise.all(process.argv.slice(1, 5).map((u) => import(u)));
		const input = JSON.parse(process.argv[5]);
		${body}
	`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			script,
			...['prompt.mjs', 'model.mjs', 'kinds.mjs', 'kind-prompt.mjs'].map(href),
			JSON.stringify(input),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const PROMPT = [
	'f07 · T322 · Prompts legibles',
	'',
	'PARA USTED',
	'Qué hará: cambia el código y abre un PR a develop.',
	'Usted: nada; el coordinador une el PR.',
	'Riesgo: bajo; el cambio llega solo a develop.',
	'',
	'QUÉ SE BUSCA',
	'Prompts legibles.',
	'Terminado cuando: las pruebas pasan.',
	'',
	...[
		'ANTES DE EMPEZAR',
		'PASOS',
		'AUTORIZO',
		'NO HAGAS',
		'DECISIONES',
		'PARE Y PREGUNTE SI',
	].flatMap((s) => [s, 'Algo.', '']),
	'AL TERMINAR',
	'1. Cierre.',
	'',
	'METADATOS',
	'formato: prompt-v1',
	'tablero: rev 1',
].join('\n');

const typed = (tipo: string, fields: Json = {}) => ({
	id: `tarea-${tipo}`,
	num: 322,
	rev: 1,
	titulo: 'Vista del tablero más clara (d291)',
	estado: 'pendiente',
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'claude',
	requisitos: [],
	tipo,
	...(tipo === 'operacion-cloudflare' ? { tipo: 'operacion', destino: 'cloudflare' } : {}),
	rama: 'feat/x',
	carrilPlaneado: 'f07-invitaciones',
	busca: 'Algo.\nTerminado cuando: listo.',
	...fields,
});

describe('PARA USTED (T322)', () => {
	it('opens a prompt-v1 with PARA USTED and lists what a broken one has wrong', () => {
		const out = probe(
			`console.log(JSON.stringify({
				ok: p.promptV1Issues(input.ok),
				missing: p.promptV1Issues(input.missing),
				late: p.promptV1Issues(input.late),
				shape: p.promptV1Issues(input.shape),
				jargon: p.promptV1Issues(input.jargon),
			}));`,
			{
				ok: PROMPT,
				missing: PROMPT.replace(/PARA USTED\n(?:.+\n){3}\n/, ''),
				late: PROMPT.replace(
					/(PARA USTED\n(?:.+\n){3}\n)(QUÉ SE BUSCA\n(?:.+\n){2}\n)/,
					'$2$1',
				),
				shape: PROMPT.replace('Usted: nada; el coordinador une el PR.', 'Usted:'),
				jargon: PROMPT.replace(
					'el coordinador une el PR',
					'd230 tras la vuelta 2 en rev 3',
				),
			},
		);
		expect(out.ok).toEqual([]);
		expect(out.missing).toEqual([]);
		expect(out.late).toContain('prompt-v1: la sección QUÉ SE BUSCA está fuera de orden');
		expect(out.shape).toEqual(['prompt-v1: PARA USTED sin texto en «Usted:»']);
		expect(out.jargon).toEqual([
			'prompt-v1: PARA USTED usa «d230», una abreviatura interna: dígalo con palabras (en una tarea con tipo: hara=… usted=… riesgo=…)',
			'prompt-v1: PARA USTED usa «rev 3», una abreviatura interna: dígalo con palabras (en una tarea con tipo: hara=… usted=… riesgo=…)',
			'prompt-v1: PARA USTED usa «vuelta 2», una abreviatura interna: dígalo con palabras (en una tarea con tipo: hara=… usted=… riesgo=…)',
		]);
	});

	it('refuses a PARA USTED with lines missing or out of order', () => {
		const out = probe(
			`console.log(JSON.stringify([p.promptV1Issues(input.two), p.promptV1Issues(input.swapped)]));`,
			{
				two: PROMPT.replace('Riesgo: bajo; el cambio llega solo a develop.\n', ''),
				swapped: PROMPT.replace(
					'Usted: nada; el coordinador une el PR.\nRiesgo: bajo; el cambio llega solo a develop.',
					'Riesgo: bajo.\nUsted: nada.',
				),
			},
		);
		const want =
			'prompt-v1: PARA USTED debe tener 3 líneas: Qué hará: … / Usted: … / Riesgo: …';
		expect(out[0]).toEqual([want]);
		expect(out[1]).toEqual([want]);
	});

	it('gives every kind three plain lines, filled with the title without its references', () => {
		const out = probe(
			`const { kinds, issues } = k.loadKinds();
			const rows = input.kinds.map((key) => {
				const t = input.tasks[key];
				const prompt = kp.kindPrompt(t, { tareas: [t], decisiones: [] }, kinds[key], { generado: '2026-10-26T00:00:00Z' });
				return { key, lines: p.promptSection(prompt, 'PARA USTED').filter(Boolean), issues: p.promptV1Issues(prompt).filter((x) => x.includes('PARA USTED')),
					second: prompt.split('\\n')[2] };
			});
			console.log(JSON.stringify({ issues, rows }));`,
			{
				kinds: KINDS,
				tasks: Object.fromEntries(KINDS.map((key) => [key, typed(key)])),
			},
		);
		expect(out.issues).toEqual([]);
		for (const row of out.rows) {
			expect(row.issues).toEqual([]);
			expect(row.second).toBe('PARA USTED');
			expect(row.lines.map((l: string) => l.split(':')[0])).toEqual([
				'Qué hará',
				'Usted',
				'Riesgo',
			]);
			expect(row.lines.join(' ')).not.toMatch(/\bd\d{3}\b|\{|\}/);
		}
		const codigo = out.rows.find((r: Json) => r.key === 'codigo');
		expect(codigo.lines[0]).toBe(
			'Qué hará: cambia el código para «Vista del tablero más clara», lo prueba y abre un PR a develop.',
		);
		expect(codigo.lines[1]).toMatch(/^Usted: nada;/);
	});

	it('keeps a task title in PARA USTED without its internal shorthand', () => {
		const out = probe(
			`const kind = k.loadKinds().kinds.codigo;
			console.log(JSON.stringify(input.titles.map((titulo) => {
				const t = { ...input.t, titulo };
				const prompt = kp.kindPrompt(t, { tareas: [t], decisiones: [] }, kind, {});
				return { hara: p.promptSection(prompt, 'PARA USTED')[0], issues: m.taskIssues({ ...t, prompt, actualizado: '2026-10-25' }) };
			})));`,
			{
				t: typed('codigo'),
				titles: [
					'Botón de vuelta atrás en el RSVP',
					'Ajuste d291 del tablero tras rev 4',
					'Arreglo (T12, d3) de la vista',
				],
			},
		);
		expect(out.map((r: Json) => r.issues)).toEqual([[], [], []]);
		expect(out.map((r: Json) => r.hara)).toEqual([
			'Qué hará: cambia el código para «Botón de vuelta atrás en el RSVP», lo prueba y abre un PR a develop.',
			'Qué hará: cambia el código para «Ajuste del tablero tras», lo prueba y abre un PR a develop.',
			'Qué hará: cambia el código para «Arreglo de la vista», lo prueba y abre un PR a develop.',
		]);
	});

	it('keeps a saved prompt-v1 without PARA USTED valid', () => {
		const out = probe(
			`console.log(JSON.stringify(m.taskIssues({ ...input.t, prompt: input.prompt, actualizado: '2026-10-25' })));`,
			{
				t: { ...typed('codigo'), tipo: undefined },
				prompt: PROMPT.replace(/PARA USTED\n(?:.+\n){3}\n/, ''),
			},
		);
		expect(out).toEqual([]);
	});

	it('lets a task replace each line with hara, usted and riesgo, and refuses jargon in them', () => {
		const out = probe(
			`const kind = k.loadKinds().kinds.codigo;
			const t = input.t;
			const prompt = kp.kindPrompt(t, { tareas: [t], decisiones: [] }, kind, {});
			console.log(JSON.stringify({
				lines: p.promptSection(prompt, 'PARA USTED').filter(Boolean),
				partial: p.promptSection(kp.kindPrompt({ ...t, hara: undefined, riesgo: undefined }, { tareas: [], decisiones: [] }, kind, {}), 'PARA USTED').filter(Boolean),
				ask: p.promptSection(prompt, 'PARE Y PREGUNTE SI').filter(Boolean).at(-1),
				bad: m.taskIssues({ ...t, usted: 'aprobar d230', riesgo: 'una\\nlínea' }),
			}));`,
			{
				t: typed('codigo', {
					hara: 'Cambia el texto del correo de recordatorio.',
					usted: 'Aprobar el texto nuevo del correo.',
					riesgo: 'Medio: el correo llega a los invitados.',
				}),
			},
		);
		expect(out.lines).toEqual([
			'Qué hará: Cambia el texto del correo de recordatorio.',
			'Usted: Aprobar el texto nuevo del correo.',
			'Riesgo: Medio: el correo llega a los invitados.',
		]);
		expect(out.partial[0]).toMatch(/^Qué hará: cambia el código para/);
		expect(out.partial[1]).toBe('Usted: Aprobar el texto nuevo del correo.');
		expect(out.ask).toContain(
			'--para=dueno "<pregunta de una línea>" --opcion="<la recomendada>" --opcion="<otra>" --detalle="<detalle técnico>"',
		);
		expect(out.bad).toEqual(
			expect.arrayContaining([
				'usted debe ser texto para el dueño; usa «d230», una abreviatura interna: dígalo con palabras',
				'riesgo debe ser texto para el dueño; debe ser una sola línea',
			]),
		);
	});

	it('refuses a kind file whose para_usted breaks the three lines or uses jargon', () => {
		const out = probe(
			`const doc = k.parseKind(input.text);
			console.log(JSON.stringify(k.kindIssues(doc, 'auditoria', ['documentation_governance'])));`,
			{
				text: readFileSync(
					path.join(ROOT, '.agent', 'kinds', 'auditoria.yaml'),
					'utf8',
				).replace(
					/para_usted:\n(?: {4}- .+\n){3}/,
					"para_usted:\n    - 'Qué hará: revisa la vuelta 2.'\n    - 'Riesgo: ninguno.'\n",
				),
			},
		);
		expect(out).toEqual(
			expect.arrayContaining([
				'para_usted debe tener 3 líneas: Qué hará: … / Usted: … / Riesgo: …',
				'para_usted usa «vuelta 2», una abreviatura interna: dígalo con palabras',
			]),
		);
	});

	it('opens review rounds with PARA USTED too, without the word for a round', () => {
		const out = probe(
			`const src = { id: 'origen', num: 7, titulo: 'Origen', pr: '#522', rama: 'feat/x', urgencia: 'normal' };
			const prev = { id: 'origen-revision', vuelta: 1, revisionSha: 'a'.repeat(40) };
			const r = await import(input.rounds);
			const first = r.reviewChild(src, { agente: 'codex', sha: input.sha, num: 9, generado: '2026-10-26T00:00:00Z' });
			const second = r.reviewChild(src, { agente: 'gemini', sha: input.sha, prev, num: 10, generado: '2026-10-26T00:00:00Z' });
			console.log(JSON.stringify([first, second].map((t) => ({
				lines: p.promptSection(t.prompt, 'PARA USTED').filter(Boolean),
				issues: p.promptV1Issues(t.prompt),
			}))));`,
			{ sha: SHA, rounds: pathToFileURL(path.join(BOARD, 'rounds.mjs')).href },
		);
		expect(out[0].issues).toEqual([]);
		expect(out[1].issues).toEqual([]);
		expect(out[0].lines).toEqual([
			'Qué hará: revisa el PR #522 sin cambiar código y publica lo que encuentre.',
			'Usted: nada; el coordinador une el PR cuando la revisión lo aprueba.',
			'Riesgo: ninguno; la revisión solo lee el código.',
		]);
		expect(out[1].lines[0]).toBe(
			'Qué hará: revisa otra vez el PR #522 tras los cambios del autor sin cambiar código y publica lo que encuentre.',
		);
	});
});

function makeBoard(tareas: Json[]) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-readable-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	for (const [i, { id, ...doc }] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${id}.json`),
			JSON.stringify({ num: i + 1, ...doc }),
		);
	return dir;
}

function cli(dir: string, args: string[]) {
	const result = runCommand(process.execPath, [path.join(BOARD, 'board.mjs'), ...args], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: '' }),
	});
	return { status: result.status, out: String(result.stdout), err: String(result.stderr) };
}

const readLog = (dir: string): Json[] =>
	readdirSync(path.join(dir, 'bitacora'))
		.filter((f) => f.endsWith('.jsonl'))
		.flatMap((f) =>
			readFileSync(path.join(dir, 'bitacora', f), 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		);

const plain = {
	id: 'servicio',
	titulo: 'Servicio',
	estado: 'en curso',
	urgencia: 'normal',
	actor: 'sesion',
	agente: 'claude',
	requisitos: [],
	prompt: 'T1 · servicio\nDECISIONES\n- ninguna',
	rev: 1,
	actualizado: '2026-10-26T00:00:00Z',
};

describe('messages to the owner (T322)', () => {
	it('keeps a one-line question with its options, the recommended one first, and the detail apart', () => {
		const dir = makeBoard([plain]);
		const sent = cli(dir, [
			'msg',
			'T1',
			'--de=claude',
			'--para=dueno',
			'¿Publico la invitación hoy?',
			'--opcion=Sí, hoy (recomendada)',
			'--opcion=Mañana, después de revisarla',
			'--detalle=PR #600 en a1b2c3d; d230.\\nLa vuelta 2 aprobó.',
		]);
		expect(sent.err).toBe('');
		expect(sent.status).toBe(0);
		const [row] = readLog(dir);
		expect(row.mensaje).toMatchObject({
			para: 'dueno',
			texto: '¿Publico la invitación hoy?',
			opciones: ['Sí, hoy (recomendada)', 'Mañana, después de revisarla'],
			detalle: 'PR #600 en a1b2c3d; d230.\\nLa vuelta 2 aprobó.',
		});
		const inbox = cli(dir, ['inbox', '--agente=dueno']);
		expect(inbox.out).toContain(
			'claude → dueno sobre T1: ¿Publico la invitación hoy? Opciones: 1) Sí, hoy (recomendada) · 2) Mañana, después de revisarla (detalle técnico: pnpm board inbox)',
		);
		expect(inbox.out).toContain(
			'  Detalle técnico:\n    PR #600 en a1b2c3d; d230.\n    La vuelta 2 aprobó.',
		);
	});

	it('refuses an owner message that is not one plain question or lists options badly', () => {
		const dir = makeBoard([plain]);
		const send = (...args: string[]) =>
			cli(dir, ['msg', 'T1', '--de=claude', '--para=dueno', ...args]);
		expect(send('Ya quedó el PR.').err).toContain(
			'el texto para el dueño debe ser una pregunta («¿…?»)',
		);
		expect(send('¿Sigo con la vuelta 2 según d230?').err).toContain(
			'la pregunta usa «d230», una abreviatura interna: dígalo con palabras; la pregunta usa «vuelta 2»',
		);
		expect(send('¿Sigo?\\n¿O paro?').err).toContain('la pregunta debe ser una sola línea');
		expect(send('¿Sigo?', '--opcion=Sí').err).toContain(
			'una decisión necesita al menos dos --opcion',
		);
		expect(send('¿Sigo?', '--opcion=No', '--opcion=Sí (recomendada)').err).toContain(
			'la opción recomendada va primero',
		);
		expect(send(`¿${'a'.repeat(200)}?`).err).toContain('pasa de 200 caracteres');
		expect(
			cli(dir, [
				'msg',
				'T1',
				'--de=claude',
				'--para=codex',
				'Hola',
				'--opcion=A',
				'--opcion=B',
			]).err,
		).toContain('--opcion solo va en mensajes --para=dueno');
		expect(readdirSync(dir)).not.toContain('bitacora');
		// Messages to agents keep their free text, technical detail included.
		expect(cli(dir, ['msg', 'T1', '--de=claude', '--para=codex', 'rev 3 en d230']).status).toBe(
			0,
		);
	});
});
