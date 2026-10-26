import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const BOARD = path.join(ROOT, 'scripts', 'board');
const VIEW = readFileSync(path.join(BOARD, 'view.html'), 'utf8');
const CSS = /<style>([\s\S]*?)<\/style>/.exec(VIEW)?.[1] ?? '';

/** Runs `code` with `f` = format.mjs and `b` = the fixture board; returns what it prints as JSON. */
function probe(code: string, board: unknown = FIXTURE) {
	const src = `const f = await import(process.argv[1]); const b = JSON.parse(process.argv[2]); ${code}`;
	const href = pathToFileURL(path.join(BOARD, 'format.mjs')).href;
	const result = runCommand(
		process.execPath,
		['--input-type=module', '-e', src, href, JSON.stringify(board)],
		{ cwd: ROOT, allowFailure: true, env: sanitizeEnv({}) },
	);
	if (result.status !== 0) throw new Error(String(result.stderr));
	return JSON.parse(String(result.stdout));
}

const msg = (id: string, quien: string, para: string, tarea: string, texto: string) => ({
	tarea,
	en: '2026-10-26T05:00:00Z',
	quien,
	mensaje: { id, para, texto },
});
const FIXTURE = {
	tareas: [
		{
			id: 'tablero-vista',
			num: 321,
			titulo: 'Página del tablero',
			estado: 'en curso',
			agente: 'claude',
			prompt: 'x',
			rama: 'feat/board-overview-tab',
		},
		{
			id: 'copia-nocturna',
			num: 302,
			titulo: 'Copia nocturna R2',
			estado: 'en revision',
			agente: 'claude',
			pr: '#594',
			actualizado: '2026-10-25T20:00:00Z',
		},
		{
			id: 'vieja',
			num: 200,
			titulo: 'Tarea vieja del tablero',
			estado: 'hecha',
			archivada: '2026-10-20T00:00:00Z',
		},
	],
	decisiones: [{ id: 'd210', decision: 'El tablero se recarga solo', vigente: true }],
	bitacora: [
		msg(
			'm1',
			'codex',
			'dueno',
			'tablero-vista',
			'T321 tablero-vista (PR #600): Git Safety finish vio el HEAD 388396a en feat/x. ¿Confirma el cambio? Recomendado: sí. Corrí `pnpm board review`.',
		),
		msg('m2', 'gemini', 'coordinador', 'tablero-vista', 'T321 · listo para unir'),
	],
	carriles: [{ id: 'f09-docs' }, { id: 'f10-libre' }],
	bandejas: [],
};

describe('board overview: owner actions and tab counts (T321)', () => {
	it('gives each owner row a verb and never counts a message to the coordinator', () => {
		const r = probe(
			'console.log(JSON.stringify({acts: f.ownerActions(b).map((x) => [x.tipo, x.verbo]), n: f.tabCounts(b)}))',
		);
		expect(r.acts).toEqual([['mensaje', 'Responder a Codex']]);
		expect(r.n.usted).toBe(r.acts.length);
	});

	it('names the owner verb of each row kind and counts exactly the rows it lists', () => {
		const task = (id: string, num: number, fields: Record<string, unknown>) => ({
			id,
			num,
			titulo: id,
			estado: 'pendiente',
			actor: 'sesion',
			agente: 'claude',
			urgencia: 'normal',
			requisitos: [],
			prompt: 'x',
			...fields,
		});
		const board = {
			tareas: [
				task('hacer', 1, { actor: 'dueno', agente: 'cualquiera' }),
				task('aprobar', 2, { actor: 'coordinador', toca: ['main'] }),
				task('decidir', 3, { requisitos: [{ tipo: 'dueno', ref: '¿Publica hoy?' }] }),
				task('fin', 4, {
					estado: 'hecha',
					cierre: {
						resumen: ['Listo'],
						comprobaciones: ['pnpm test'],
						saltadas: ['ninguna'],
						pendientes: [],
						fallidas: [],
						riesgos: [],
						dudas: [],
						excepciones: [],
						en: '2026-10-25T00:00:00Z',
					},
				}),
			],
			decisiones: [],
			bitacora: [],
			carriles: [],
			bandejas: [],
		};
		const r = probe(
			'console.log(JSON.stringify({acts: f.ownerActions(b).map((x) => [x.tipo, x.verbo, x.id]), n: f.tabCounts(b)}))',
			board,
		);
		expect(r.acts).toEqual([
			['tarea', 'Aprobar', 'aprobar'],
			['tarea', 'Hacer', 'hacer'],
			['decision', 'Decidir', 'decidir'],
			['archivar', 'Archivar', null],
		]);
		expect(r.n.usted).toBe(r.acts.length);
		expect(r.n.finalizadas).toBe(1);
	});

	it('counts the Cola as its open tasks plus its review group, and lanes held out of all', () => {
		const r = probe('console.log(JSON.stringify(f.tabCounts(b)))');
		expect(r.cola).toBe(2);
		expect(r.finalizadas).toBe(0);
		expect(r.carriles).toBe('0/2');
	});
});

describe('board overview: readable messages (T321)', () => {
	it('drops the repeated task prefix and splits question, context and technical detail', () => {
		const r = probe(
			'console.log(JSON.stringify({...f.messageParts(b.bitacora[0], b), t: null}))',
		);
		expect(r).toMatchObject({
			de: 'Codex',
			para: 'usted',
			tarea: 'T321',
			pregunta: '¿Confirma el cambio?',
			contexto: ['Recomendado: sí.'],
			detalle: [
				'Git Safety finish vio el HEAD 388396a en feat/x.',
				'Corrí `pnpm board review`.',
			],
		});
	});

	it('never takes a URL query string as the question and carries stored options and detail', () => {
		const row = {
			...msg(
				'm3',
				'codex',
				'dueno',
				'tablero-vista',
				'Vea https://x.test/a?b=1 en el PR. ¿Publica hoy?',
			),
		};
		row.mensaje = {
			...row.mensaje,
			opciones: ['Sí, hoy', 'Mañana'],
			detalle: 'SHA 388396a\\nrama feat/x',
		} as typeof row.mensaje;
		const r = probe(
			`console.log(JSON.stringify({...f.messageParts(${JSON.stringify(row)}, b), t: null}))`,
		);
		expect(r.pregunta).toBe('¿Publica hoy?');
		expect(r.opciones).toEqual(['Sí, hoy', 'Mañana']);
		expect(r.detalle).toEqual([
			'Vea https://x.test/a?b=1 en el PR.',
			'SHA 388396a',
			'rama feat/x',
		]);
		// The owner card shows the options, and a focused card opens with the keyboard.
		expect(VIEW).toContain('Opciones: ${esc(optionsText(m.opciones))}');
		expect(VIEW).toContain('data-all="1" tabindex="0"');
	});

	it('rewrites a «Mensaje: … sobre T307: T307 …» row without its repeated prefix', () => {
		expect(
			probe(
				"console.log(JSON.stringify(f.rowText('Mensaje: gemini → coordinador sobre T307: T307 tablero-x (PR #587): T307 · listo')))",
			),
		).toBe('Gemini → Coordinador: listo');
		// A hyphenated word that is not followed by «(PR …)» or «:» is text, not the task id.
		expect(
			probe(
				"console.log(JSON.stringify(f.rowText('Mensaje: x → coordinador sobre T307: T307 pre-merge listo')))",
			),
		).toBe('x → Coordinador: pre-merge listo');
		expect(probe("console.log(JSON.stringify(f.rowText('Abrir una sesión para T1')))")).toBe(
			'Abrir una sesión para T1',
		);
	});

	it('renders a task reference as a quiet inline link, never a bordered block', () => {
		expect(
			probe(
				`console.log(JSON.stringify(f.richText('Vea T321 hoy', { task: (n) => b.tareas.find((t) => t.num === n) })))`,
			),
		).toBe(
			'Vea <a class="tl" href="#cola" data-sel="tablero-vista" data-jump="1" data-all="1" title="Página del tablero">T321</a> hoy',
		);
		const rule = /a\.tl,a\.dl,span\.tl\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
		expect(rule).not.toMatch(/border|display/);
		// Row text sits in its own inline span inside the grid column, so a link cannot split the sentence.
		expect(VIEW).toContain('<span><span>${tt(rowText(x.texto))}</span></span>');
		expect(CSS).toContain(
			'.tab .n{margin-left:auto;font:400 .74rem var(--mono);color:var(--faint)}',
		);
	});
});

describe('board overview: global search (T321)', () => {
	it('finds tasks in every section with their section labels, by number, PR and words', () => {
		const sections = (q: string) =>
			probe(
				`console.log(JSON.stringify(f.globalSearch(b, ${JSON.stringify(q)}).map((x) => [x.t ? x.t.num : x.d.id, x.secciones])))`,
			);
		expect(sections('T321')).toEqual([[321, ['Para usted', 'Cola']]]);
		expect(sections('#594')).toEqual([[302, ['Cola']]]);
		expect(sections('tablero')).toEqual([
			[321, ['Para usted', 'Cola']],
			[200, ['Finalizadas · archivada']],
			['d210', ['Historial']],
		]);
		expect(sections('')).toEqual([]);
	});

	it('returns every match when asked, so the view can count past what it lists', () => {
		const many = {
			...FIXTURE,
			tareas: Array.from({ length: 65 }, (_, i) => ({
				id: `tarea-${i}`,
				num: i + 1,
				titulo: `Ajuste ${i}`,
				estado: 'hecha',
			})),
		};
		const n = probe(
			"console.log(JSON.stringify([f.globalSearch(b, 'ajuste').length, f.globalSearch(b, 'ajuste', { max: Infinity }).length]))",
			many,
		);
		expect(n).toEqual([60, 65]);
		expect(VIEW).toContain('S.found=all.length;');
		expect(VIEW).toContain('Se muestran ${hits.length} de ${all.length}.');
	});

	it('opens on «General», keeps the tab during a search and returns to it when cleared', () => {
		expect(VIEW).toContain("ready:false,sel:null,tab:'general',");
		expect(VIEW).toContain("TABS.forEach(k=>$('p-'+k).hidden=q||k!==S.tab);");
		expect(VIEW).toContain("$('tq').addEventListener('input',onSearch);");
	});
});
