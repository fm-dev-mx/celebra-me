import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/board-command';
import { hasBoardDoc, readBoardDoc } from '../helpers/board-doc';

const ROOT = process.cwd();
const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const OLD = 'c'.repeat(40);
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(previous = false) {
	const dir = mkdtempSync(path.join(tmpdir(), 'review-preflight-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	writeFileSync(
		path.join(dir, 'tareas', 'codigo.json'),
		JSON.stringify({
			num: 1,
			titulo: 'Código',
			estado: 'en revision',
			agente: 'codex',
			pr: '#10',
			urgencia: 'normal',
			actor: 'sesion',
			requisitos: [],
			rev: 1,
			sesion: { agente: 'codex', id: 'author-chat', nombre: 'Autor' },
			cierre: {
				resumen: 'Hecho',
				comprobaciones: [],
				saltadas: [],
				pendientes: [],
				en: '2026-10-25T00:00:00Z',
			},
		}),
	);
	if (previous)
		writeFileSync(
			path.join(dir, 'tareas', 'codigo-revision.json'),
			JSON.stringify({
				num: 2,
				titulo: 'Anterior',
				origen: 'codigo',
				revisionSha: OLD,
				vuelta: 1,
				estado: 'hecha',
				agente: 'claude',
				rev: 1,
				cierre: {
					resumen: 'Revisada',
					comprobaciones: [],
					saltadas: [],
					pendientes: [],
					en: '2026-10-25T00:00:00Z',
					resultado: { veredicto: 'cambios', sha: OLD, hallazgos: [] },
				},
			}),
		);
	return dir;
}
function review(dir: string, evidence: unknown = {}) {
	return runCommand(
		process.execPath,
		[
			path.join(ROOT, 'scripts/board/board.mjs'),
			'review',
			'codigo',
			`--sha=${SHA}`,
			'--coordinador',
			'--quien=claude',
		],
		{
			cwd: ROOT,
			allowFailure: true,
			env: sanitizeEnv({
				CELEBRA_BOARD_DIR: dir,
				BOARD_TEST_PREFLIGHT: JSON.stringify(evidence),
			}),
		},
	);
}
const read = (dir: string, id: string) => readBoardDoc(dir, id) as Record<string, any>;

describe('board review merge preflight', () => {
	it('extracts exact conflict paths from real merge-tree output without changing HEAD or index', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'merge-tree-'));
		dirs.push(dir);
		const git = (...args: string[]) =>
			runCommand('git', args, { cwd: dir, env: sanitizeEnv({}) }).stdout.trim();
		git('init', '-b', 'base');
		git('config', 'user.name', 'Fixture');
		git('config', 'user.email', 'fixture@example.invalid');
		git('config', 'commit.gpgsign', 'false');
		const commit = (text: string) => {
			writeFileSync(path.join(dir, 'conflict.txt'), text);
			git('add', 'conflict.txt');
			git('-c', 'core.hooksPath=disabled-hooks', 'commit', '-m', 'fixture');
		};
		commit('original\n');
		git('branch', 'head');
		commit('base\n');
		const base = git('rev-parse', 'HEAD');
		git('switch', 'head');
		commit('head\n');
		const head = git('rev-parse', 'HEAD');
		const source = `
			import cp from 'node:child_process';
			import {syncBuiltinESMExports} from 'node:module';
			const exec=cp.execFileSync;
			cp.execFileSync=(cmd,args,opts)=>cmd==='gh'?JSON.stringify({state:'OPEN',headRefOid:'${head}',baseRefOid:'${base}',mergeable:'CONFLICTING'}):exec(cmd,args,opts);
			syncBuiltinESMExports();
			const {reviewPreflight}=await import(process.argv[1]);
			console.log(JSON.stringify(reviewPreflight({pr:'#10'},'${head}')));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				source,
				pathToFileURL(path.join(ROOT, 'scripts/board/review-preflight.mjs')).href,
			],
			{ cwd: dir },
		);
		expect(JSON.parse(result.stdout).conflicts).toEqual(['conflict.txt']);
		expect(git('rev-parse', 'HEAD')).toBe(head);
		expect(git('status', '--porcelain')).toBe('');
	});
	it('rejects conflicts before creating or replacing a round and notifies the author session with the conflict paths', () => {
		const dir = fixture(true);
		const before = read(dir, 'codigo-revision');
		const result = review(dir, {
			pr: { mergeable: 'CONFLICTING' },
			merge: { status: 1, stdout: `${BASE}\0src/a.ts\0src/b.ts\0\0details` },
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain('conflictos de merge');
		expect(hasBoardDoc(dir, 'codigo-revision-2')).toBe(false);
		expect(read(dir, 'codigo-revision')).toEqual(before);
		const logs = readdirSync(path.join(dir, 'bitacora')).filter((f) => f.endsWith('.jsonl'));
		const row = JSON.parse(readFileSync(path.join(dir, 'bitacora', logs[0]), 'utf8').trim());
		expect(row).toMatchObject({
			tarea: 'codigo',
			mensaje: { para: 'codex', sesion: 'author-chat' },
		});
		expect(row.mensaje.texto).toContain('T1 codigo');
		expect(row.mensaje.texto).toContain('src/a.ts, src/b.ts');
		expect(row.mensaje.texto).toContain('merge normal');
		expect(row.mensaje.texto).toContain('nunca rebase ni push --force');
	});
	it.each([
		{ fail: true },
		{ pr: { mergeable: 'UNKNOWN' } },
		{ pr: { headRefOid: OLD } },
		{ pr: { state: 'CLOSED' } },
	])('fails closed on unavailable, pending or stale GitHub evidence: %j', (evidence) => {
		const dir = fixture();
		expect(review(dir, evidence).status).toBe(2);
		expect(hasBoardDoc(dir, 'codigo-revision')).toBe(false);
	});
	it('still rejects confirmed conflicts when local objects are missing and marks the paths unverified', () => {
		const dir = fixture();
		const result = review(dir, {
			pr: { mergeable: 'CONFLICTING' },
			merge: { status: 128, stdout: '' },
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain('Archivos: UNVERIFIED');
	});
	it('creates a risk-segmented round and pins later work to the incremental diff', () => {
		const dir = fixture(true);
		expect(review(dir).status).toBe(0);
		const task = read(dir, 'codigo-revision-2');
		expect(task.prompt).toContain('Tier 0');
		expect(task.prompt).toContain(`diff incremental ${OLD}..${SHA}`);
		expect(task.revisionFiles).toEqual(['docs/example.md']);
	});
	it('uses a deep review when the GitHub file inventory is incomplete', () => {
		const dir = fixture();
		expect(review(dir, { pr: { changedFiles: 101 } }).status).toBe(0);
		expect(read(dir, 'codigo-revision').prompt).toContain('Tier 2');
	});
});

describe('kind-prompt review risk and incremental scope', () => {
	it('classifies docs, frontend, sensitive and unknown paths conservatively and renders guidance', () => {
		const src = `
			const kp = await import(process.argv[1]);
			const files = [['docs/guide.md', '.agent/rules/board.md'], ['src/components/Card.astro','src/styles/card.scss'],
			 ['docs/guide.md','src/pages/api/rsvp.ts'], ['src/lib/auth/session.ts'], ['supabase/migrations/x.sql'], ['scripts/board/board.mjs'], undefined];
			const kind = {tipo:'revision', para_usted:['Qué hará: revisa.', 'Usted: nada.', 'Riesgo: ninguno.'], lee:[], pasos_inicio:[], pasos:[], autorizado_por_defecto:[], no_hagas:[], pare_si:[], al_terminar:[]};
			const t = {id:'x-revision-2', num:3, titulo:'Revisión', tipo:'revision', origen:'x', vuelta:2, revisionSha:'${SHA}', revisionFiles:files[1]};
			const board = {tareas:[{id:'x-revision', origen:'x', vuelta:1, revisionSha:'${OLD}'}]};
			console.log(JSON.stringify({tiers:files.map(kp.reviewRisk),prompt:kp.kindPrompt(t,board,kind,{generado:'2026-10-25T00:00:00Z'})}));
		`;
		const result = runCommand(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				src,
				pathToFileURL(path.join(ROOT, 'scripts/board/kind-prompt.mjs')).href,
			],
			{ cwd: ROOT },
		);
		const out = JSON.parse(result.stdout);
		expect(out.tiers).toEqual([0, 1, 2, 2, 2, 2, 2]);
		expect(out.prompt).toContain('Tier 1');
		expect(out.prompt).toContain(`diff incremental ${OLD}..${SHA}`);
	});
});
