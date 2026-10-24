import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const MODEL_PATH = path.join(ROOT, 'scripts', 'board', 'model.mjs');
const VIEW = readFileSync(path.join(ROOT, 'scripts', 'board', 'view.html'), 'utf8');

const BOARD = {
	tareas: [{ id: 'board-agent-alignment', num: 35, titulo: 'Dividir reglas del tablero' }],
	archivo: [{ id: 'vieja', num: 12, titulo: 'Quitar la página de operaciones' }],
	decisiones: [
		{ id: 'd183', decision: 'Claude revisa el trabajo de Codex y Gemini.', vigente: true },
		{ id: 'd099', decision: 'Reemplazada.', vigente: false },
	],
};

/** Runs `requisitoText` from model.mjs on each requisito, in both forms. */
function texts(reqs: Array<Record<string, string>>) {
	const probe = String.raw`
		const m = await import(process.argv[1]);
		const board = JSON.parse(process.argv[2]);
		const reqs = JSON.parse(process.argv[3]);
		console.log(JSON.stringify(reqs.map((r) => [
			m.requisitoText(r, board),
			m.requisitoText(r, board, { espera: true }),
		])));
	`;
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			probe,
			pathToFileURL(MODEL_PATH).href,
			JSON.stringify(BOARD),
			JSON.stringify(reqs),
		],
		{ cwd: ROOT, allowFailure: true },
	);
	expect(result.status).toBe(0);
	return JSON.parse(String(result.stdout)) as Array<[string, string]>;
}

describe('readable requisitos (T41)', () => {
	it('names a task by its number and title, never by its id', () => {
		const [live, archived, missing] = texts([
			{ tipo: 'tarea', ref: 'board-agent-alignment' },
			{ tipo: 'tarea', ref: 'vieja' },
			{ tipo: 'tarea', ref: 'borrada' },
		]);
		expect(live).toEqual([
			'Termina T35 · Dividir reglas del tablero',
			'Espera T35 · Dividir reglas del tablero',
		]);
		expect(archived[1]).toBe('Espera T12 · Quitar la página de operaciones (archivada)');
		expect(missing[0]).toBe('Termina la tarea «borrada», que ya no está en el tablero');
	});

	it('explains reviews, decisions, dates, owner answers and missing prompts in words', () => {
		const [rev, dec, old, absent, fecha, dueno, prompt] = texts([
			{ tipo: 'revision', ref: 'board-agent-alignment' },
			{ tipo: 'decision', ref: 'd183' },
			{ tipo: 'decision', ref: 'd099' },
			{ tipo: 'decision', ref: 'd900' },
			{ tipo: 'fecha', ref: '2026-10-26T18:00:00Z' },
			{ tipo: 'dueno', ref: 'Elegir la foto' },
			{ tipo: 'prompt', ref: '' },
		]);
		expect(rev[1]).toBe('Espera el PR en revisión de T35 · Dividir reglas del tablero');
		expect(dec[0]).toBe('Decisión d183: Claude revisa el trabajo de Codex y Gemini.');
		expect(old[1]).toBe('Espera la decisión d099 (ya no vigente)');
		expect(absent[0]).toBe('Decisión d900 (todavía no existe)');
		expect(fecha[0]).toMatch(/^Llega el lun.*26.*oct/);
		expect(dueno).toEqual([
			'Le toca a usted: Elegir la foto',
			'Espera su respuesta: Elegir la foto',
		]);
		expect(prompt[0]).toBe('Falta el prompt (lo escribe el coordinador)');
		for (const [a, b] of [rev, dec, old, absent, fecha, dueno, prompt])
			expect(`${a} ${b}`).not.toMatch(/\b(tarea|revision|decision|fecha|dueno) [a-z0-9-]+/);
	});

	it('uses the same text in the view and shows the prompt as a document', () => {
		expect(VIEW).toContain("import { requisitoText, taskName } from '/model.mjs';");
		expect(VIEW).toContain('requisitoText(r,S.board,{espera:true})');
		expect(VIEW).not.toContain("'Espera: '+");
		expect(VIEW).not.toContain('<pre class="prompt"');
		expect(VIEW).toContain('<div class="prompt" id="prtext">${promptHtml(p)}</div>');
		expect(VIEW).not.toMatch(/\.prompt\{[^}]*var\(--mono\)/);
	});

	it('keeps the view script valid JavaScript', () => {
		const script = /<script type="module">([\s\S]*?)<\/script>/.exec(VIEW)?.[1] ?? '';
		expect(script).toContain('promptHtml');
		const dir = mkdtempSync(path.join(tmpdir(), 'board-view-'));
		const file = path.join(dir, 'view-script.mjs');
		writeFileSync(file, script);
		const result = runCommand(process.execPath, ['--check', file], {
			cwd: ROOT,
			allowFailure: true,
		});
		rmSync(dir, { recursive: true, force: true });
		expect(String(result.stderr)).toBe('');
		expect(result.status).toBe(0);
	});
});
