import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const moduleUrl = (name: string) => pathToFileURL(path.join(ROOT, 'scripts', 'board', name)).href;
const SHA = 'd'.repeat(40);

/** Runs `body` in Node with `p` (prompt.mjs) and `m` (model.mjs) loaded; the last value printed is JSON. */
function probe(body: string, input: unknown = null) {
	const script = String.raw`
		const p = await import(process.argv[1]);
		const m = await import(process.argv[2]);
		const input = JSON.parse(process.argv[3]);
		${body}
	`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			script,
			moduleUrl('prompt.mjs'),
			moduleUrl('model.mjs'),
			JSON.stringify(input),
		],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	expect(result.stderr).toBe('');
	return JSON.parse(String(result.stdout));
}

/** A task prompt in prompt-v1, as the coordinator writes it. */
const TASK_PROMPT = [
	'f05 · T160 · Formato de prompts v1',
	'',
	'PARA USTED',
	'Qué hará: cambia el formato de los prompts y abre un PR a develop.',
	'Usted: nada; el coordinador une el PR cuando la revisión lo aprueba.',
	'Riesgo: bajo; el cambio llega solo a develop.',
	'',
	'QUÉ SE BUSCA',
	'Que cada prompt siga prompt-v1.',
	'Terminado cuando: las pruebas lo fijan.',
	'',
	'ANTES DE EMPEZAR',
	'Carril f05-plataforma. Compruebe la rev del tablero; si cambió, pare.',
	'',
	'PASOS',
	'1. Cambie la plantilla.',
	'',
	'AUTORIZO',
	'Modo rápido hasta develop.',
	'',
	'NO HAGAS',
	'- No toque main ni f10-libre.',
	'',
	'DECISIONES',
	'- d230: avisos al dueño también por board msg.',
	'',
	'PARE Y PREGUNTE SI',
	'La propuesta deja algo abierto.',
	'',
	'AL TERMINAR',
	'1. pnpm validate:changed en verde.',
	'',
	'METADATOS',
	'formato: prompt-v1',
	'tarea: formato-prompts',
	'agente: claude',
	'carril: f05-plataforma',
	'rama: feat/board-prompt-v1',
	'base: develop',
	`sha: ${SHA}`,
	'decisiones: d230',
	'tablero: rev 3',
	'generado: 2026-10-25T02:55:37Z',
].join('\n');

const task = (fields: Record<string, unknown>) => ({
	id: 'formato-prompts',
	num: 160,
	titulo: 'Formato de prompts',
	estado: 'pendiente',
	urgencia: 'normal',
	actor: 'sesion',
	requisitos: [],
	rev: 4,
	actualizado: '2026-10-25T02:55:37Z',
	...fields,
});

describe('prompt-v1 (T160)', () => {
	it('reminds generated and delivered prompts to reuse task authorization exactly once', () => {
		const out = probe(
			`
			const delivered = m.promptWithLane(input, {tareas: []});
			const built = p.buildPrompt({identidad: 'f07 · T431 · Permissions',
				secciones: [['AUTORIZO', ['git commit']]], metadatos: []});
			console.log(JSON.stringify({delivered, built,
				twice: p.withAuthorizationReminder(delivered) === delivered,
				legacy: p.withAuthorizationReminder('legacy'), line: p.AUTHORIZED_COMMANDS_LINE}));
		`,
			task({ prompt: TASK_PROMPT }),
		);
		expect(out.delivered).toContain(out.line);
		expect(out.built).toContain(out.line);
		expect(out.delivered.split(out.line)).toHaveLength(2);
		expect(out.delivered).toContain('Modo rápido hasta develop.');
		expect(out.twice).toBe(true);
		expect(out.legacy).toBe('legacy');
	});
	it('adds MCP equivalence and inbox checks to generated and saved prompts without duplication', () => {
		const out = probe(
			`const copied = m.promptWithLane(input, { tareas: [] });
			const generated = p.buildPrompt({
				identidad: 'f11 · T430 · Prueba',
				secciones: p.PROMPT_SECTIONS.filter(s => s !== 'METADATOS').map(s => [s, ['Contenido']]),
				metadatos: [['agente', 'gemini']],
			});
			console.log(JSON.stringify({ copied, generated,
				twice: p.withBoardAccess(copied),
				legacy: p.withBoardAccess('Legacy prompt'),
				owner: m.promptWithLane({ ...input, actor: 'dueno' }, { tareas: [] }),
				start: p.promptSection(copied, 'ANTES DE EMPEZAR'),
				end: p.promptSection(copied, 'AL TERMINAR'),
			}));`,
			task({ prompt: TASK_PROMPT }),
		);
		expect(out.start.join('\n')).toContain('MCP de celebra-board equivalen');
		expect(out.start.join('\n')).toContain('al empezar: pnpm board inbox --agente=claude');
		expect(out.end.join('\n')).toContain('al terminar: pnpm board inbox --agente=claude');
		expect(out.generated).toContain('pnpm board inbox --agente=gemini');
		expect(out.twice).toBe(out.copied);
		expect(out.legacy).toBe('Legacy prompt');
		expect(out.owner).toBe(TASK_PROMPT);
	});

	it('accepts a task prompt and keeps its session name on line 1 when copied', () => {
		const t = task({ prompt: TASK_PROMPT, carrilPlaneado: 'f05-plataforma' });
		const out = probe(
			`console.log(JSON.stringify({
				v1: p.isPromptV1(input.prompt),
				issues: m.taskIssues(input),
				meta: p.promptMetadata(input.prompt),
				copied: m.promptWithLane(input, { tareas: [input] }),
				lanes: m.promptLanes(input, [{ id: 'f05-plataforma', segment: 'f05' }, { id: 'f10-libre', segment: 'f10' }]),
			}));`,
			t,
		);
		expect(out.v1).toBe(true);
		expect(out.issues).toEqual([]);
		expect(out.meta).toMatchObject({ formato: 'prompt-v1', sha: SHA, tablero: 'rev 3' });
		const copied = out.copied.split('\n');
		expect(copied[0]).toBe('f05 · T160 · Formato de prompts v1');
		expect(out.copied).not.toContain('CARRIL\n');
		expect(copied.slice(-3)).toEqual([
			'corre: f05-plataforma · carpeta celebra-me-worktrees/f05-plataforma',
			'corre: Codex o Gemini: abra el proyecto f05-plataforma',
			'corre: carril libre',
		]);
		// Only ANTES DE EMPEZAR and «carril:» say where a prompt-v1 runs; NO HAGAS may name another lane.
		expect(out.lanes).toEqual([]);
	});

	it('adds the pre-push check under AL TERMINAR only to prompts that push a branch (d246)', () => {
		const readOnly = TASK_PROMPT.replace(
			'carril: f05-plataforma',
			'carril: f04-coordinador (solo lectura)',
		);
		const out = probe(
			`const copy = (prompt) => m.promptWithLane({ ...input, prompt }, { tareas: [] });
			const once = copy(input.prompt);
			console.log(JSON.stringify({
				once,
				twice: p.withPushCheck(once) === once,
				noBranch: p.withPushCheck(input.prompt.replace('rama: feat/board-prompt-v1\\n', '')),
				readOnly: p.withPushCheck(input.readOnly),
				owner: m.promptWithLane({ ...input, actor: 'dueno' }, { tareas: [] }),
			}));`,
			{ ...task({ prompt: TASK_PROMPT }), readOnly },
		);
		const lines = out.once.split('\n');
		const line = lines[lines.indexOf('AL TERMINAR') + 1];
		expect(line).toMatch(
			/^- Antes de cada push: pnpm validate:changed .* pnpm validate:structure;/u,
		);
		// d282: the author reviews its own diff before the push.
		expect(lines[lines.indexOf('AL TERMINAR') + 2]).toMatch(
			/^- Antes del push: corra \/code-review sobre su propio diff/u,
		);
		expect(lines[lines.indexOf('AL TERMINAR') + 3]).toBe('1. pnpm validate:changed en verde.');
		expect(out.twice).toBe(true);
		expect(out.noBranch).not.toContain(line);
		expect(out.readOnly).toBe(readOnly);
		expect(out.owner).toBe(TASK_PROMPT);
	});

	it('keeps a legacy prompt working: no prompt-v1 checks, CARRIL first', () => {
		const legacy = 'T12 · Algo\n\nQUÉ SE BUSCA\nX.\n\nDECISIONES\n- ninguna';
		const out = probe(
			`console.log(JSON.stringify({
				issues: m.taskIssues(input),
				copied: m.promptWithLane(input, { tareas: [input] }),
			}));`,
			task({ prompt: legacy, carrilPlaneado: 'f05-plataforma' }),
		);
		expect(out.issues).toEqual([]);
		expect(out.copied.startsWith('CARRIL\nCorre en: f05-plataforma')).toBe(true);
		expect(out.copied.endsWith(legacy)).toBe(true);
	});

	it('lists what a broken prompt-v1 lacks', () => {
		const broken = TASK_PROMPT.replace('f05 · T160 · ', 'T160 · ')
			.replace('Terminado cuando: las pruebas lo fijan.\n', '')
			.replace('PARE Y PREGUNTE SI\nLa propuesta deja algo abierto.\n\n', '')
			.replace(`sha: ${SHA}`, 'sha: abc1234')
			.replace('tablero: rev 3', 'tablero: 3\ncolor: rojo\nsuelta');
		const out = probe('console.log(JSON.stringify(p.promptV1Issues(input)));', broken);
		expect(out).toEqual([
			'prompt-v1: la línea 1 debe ser el nombre de la sesión «<carril> · T<n> · PR #<n> · <descripción>»',
			'prompt-v1: falta la sección PARE Y PREGUNTE SI',
			'prompt-v1: QUÉ SE BUSCA sin «Terminado cuando:»',
			'prompt-v1: sha debe tener 40 caracteres hexadecimales',
			'prompt-v1: tablero debe ser «rev N»',
			'prompt-v1: clave de METADATOS desconocida: color',
			'prompt-v1: línea de METADATOS sin «clave: valor»: suelta',
		]);
	});

	it('writes review prompts in prompt-v1, in Spanish, with the SHA in METADATOS', () => {
		const src = {
			id: 'origen',
			num: 7,
			titulo: 'Origen',
			pr: '#522',
			rama: 'feat/x',
			urgencia: 'normal',
		};
		const prev = { id: 'origen-revision', vuelta: 1, revisionSha: 'a'.repeat(40) };
		const out = probe(
			`const r = await import(new URL('./rounds.mjs', process.argv[2]).href);
			const first = r.reviewChild(input.src, { agente: 'codex', sha: input.sha, num: 9, generado: '2026-10-25T03:00:00Z' });
			const second = r.reviewChild(input.src, { agente: 'gemini', sha: input.sha, prev: input.prev, num: 10, generado: '2026-10-25T03:00:00Z' });
			const sub = r.reviewChild(input.src, { agente: 'claude', revisor: 'subagente', sha: input.sha, num: 11, generado: '2026-10-25T03:00:00Z' });
			const issues = (t) => m.taskIssues({ ...t, rev: 1, actualizado: '2026-10-25T03:00:00Z' });
			console.log(JSON.stringify({
				first: first.prompt, second: second.prompt, sub: sub.prompt,
				issues: [issues(first), issues(second), issues(sub)],
				meta: p.promptMetadata(first.prompt),
				firstClosing: p.promptSection(first.prompt, 'AL TERMINAR').filter(Boolean),
				subClosing: p.promptSection(sub.prompt, 'AL TERMINAR').filter(Boolean),
			}));`,
			{ src, sha: SHA, prev },
		);
		expect(out.issues).toEqual([[], [], []]);
		expect(out.first.split('\n')[0]).toBe('f04 · T9 · PR #522 · Revisión');
		expect(out.second.split('\n')[0]).toBe('f04 · T10 · PR #522 · Revisión vuelta 2');
		expect(out.first).not.toContain('Follow .agent/rules/board.md');
		expect(out.first).toContain(
			'pnpm board claim origen-revision --agente=codex --titulo="f04 · T9 · PR #522 · Revisión"',
		);
		expect(out.first).toContain('--para=dueno');
		expect(out.second).toContain('SEGUNDA VUELTA');
		expect(out.second).toContain(`git diff ${'a'.repeat(40)}..${SHA}`);
		// d259: review child prompts also end AL TERMINAR with the chat archiving instruction.
		expect(out.firstClosing.at(-1)).toBe(
			'4. Archivar el chat cuando la tarea quede unida/hecha y su PR unido (d259); el despachador de Codex/Gemini archiva sus chats cuya tarea ya terminó.',
		);
		expect(out.subClosing.at(-1)).toBe(
			'3. Archivar el chat cuando la tarea quede unida/hecha y su PR unido (d259); el despachador de Codex/Gemini archiva sus chats cuya tarea ya terminó.',
		);
		expect(out.meta).toEqual({
			formato: 'prompt-v1',
			tarea: 'T9 origen-revision',
			origen: 'T7 origen',
			agente: 'codex',
			carril: 'integration (solo lectura)',
			carpeta: 'celebra-me',
			rama: 'feat/x',
			pr: '#522',
			sha: SHA,
			decisiones: 'd183',
			tablero: 'rev 1',
			generado: '2026-10-25T03:00:00Z',
		});
	});
});
