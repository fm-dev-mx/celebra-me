import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'board', 'verify-board.mjs');
const NOW = '2026-10-20T20:00:00Z';

type Json = Record<string, unknown>;
const dirs: string[] = [];

function task(id: string, fields: Json): Json {
	return {
		id,
		titulo: id,
		estado: 'en curso',
		urgencia: 'normal',
		actor: 'sesion',
		requisitos: [],
		rev: 1,
		actualizado: NOW,
		...fields,
	};
}

function makeExport(
	tareas: Json[],
	extra: { sesiones?: Json[]; decisiones?: Json[]; archivo?: Json[] } = {},
) {
	const dir = mkdtempSync(path.join(tmpdir(), 'verify-board-'));
	dirs.push(dir);
	mkdirSync(path.join(dir, 'tareas'));
	for (const [index, t] of tareas.entries())
		writeFileSync(
			path.join(dir, 'tareas', `${t.id}.json`),
			JSON.stringify({ num: index + 1, ...t }),
		);
	if (extra.decisiones) {
		mkdirSync(path.join(dir, 'decisiones'));
		for (const d of extra.decisiones)
			writeFileSync(path.join(dir, 'decisiones', `${d.id}.json`), JSON.stringify(d));
	}
	if (extra.archivo) {
		mkdirSync(path.join(dir, 'archivo'));
		for (const a of extra.archivo)
			writeFileSync(path.join(dir, 'archivo', `${a.id}.json`), JSON.stringify(a));
	}
	if (extra.sesiones)
		writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify(extra.sesiones));
	return dir;
}

function verify(dir: string, answers: Record<string, unknown>) {
	const fixture = path.join(dir, 'answers.json');
	writeFileSync(
		fixture,
		JSON.stringify({
			'gh pr list --state open --json number,headRefName,title --limit 100': '[]',
			'git worktree list --porcelain': '',
			'git ls-remote --heads origin': '',
			...answers,
		}),
	);
	const result = runCommand(process.execPath, [SCRIPT_PATH, dir, '--json'], {
		cwd: ROOT,
		allowFailure: true,
		env: sanitizeEnv({ CELEBRA_BOARD_COMMAND_FIXTURE: fixture, INIT_CWD: ROOT }),
	});
	return { status: result.status, report: JSON.parse(result.stdout) };
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('board:verify', () => {
	it.each([
		'gh api repos/o/r/pulls/1 --raw-field title=changed',
		'curl -s --output audit-output.txt https://example.invalid',
		'gh pr view 1 --json state --web',
		'git ls-remote origin refs/heads/x;whoami',
		'git -c core.sshCommand=evil ls-remote origin refs/heads/x',
	])('refuses stored command side effects: %s', (cmd) => {
		const dir = makeExport([task('unsafe', { chequeo: { cmd } })]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('RECHAZADO');
	});

	it('keeps failed and malformed checks UNVERIFIED, even when stdout looks successful', () => {
		const dir = makeExport([
			task('failed', { pr: 1, estado: 'hecha' }),
			task('invalid', { pr: 2 }),
		]);
		const { report } = verify(dir, {
			'gh pr view 1 --json state': {
				ok: false,
				output: '{"state":"MERGED"}',
				error: 'timeout',
			},
			'gh pr view 2 --json state': 'not-json',
			'gh pr list --state open --json number,headRefName,title --limit 100': 'not-json',
			'git worktree list --porcelain': { ok: false, output: '', error: 'timeout' },
		});
		expect(report.filas.map((r: Json) => r.veredicto)).toEqual(['UNVERIFIED', 'UNVERIFIED']);
		expect(report.comprobar).toEqual([]);
		expect(report.cobertura).toMatchObject({ prs: 'UNVERIFIED', ramas: 'UNVERIFIED' });
	});

	it('accepts a structured PR check without an arbitrary shell command', () => {
		const dir = makeExport([task('structured', { chequeo: { tipo: 'pr', pr: 3 } })]);
		expect(
			verify(dir, { 'gh pr view 3 --json state': '{"state":"MERGED"}' }).report.filas[0]
				.veredicto,
		).toContain('CUMPLE');
	});
	it('does not certify a review after the PR head changes', () => {
		const dir = makeExport([
			task('origin-revision', {
				origen: 'origin',
				pr: 4,
				estado: 'hecha',
				revisionSha: 'a'.repeat(40),
			}),
		]);
		const { report } = verify(dir, {
			'gh pr view 4 --json headRefOid': JSON.stringify({ headRefOid: 'b'.repeat(40) }),
		});
		expect(report.filas[0].veredicto).toBe('NO CUMPLE');
		expect(report.comprobar).toEqual([]);
	});
	it('reports dependency cycles instead of treating the queue as healthy', () => {
		const dir = makeExport([
			task('a', { requisitos: [{ tipo: 'tarea', ref: 'b' }] }),
			task('b', { requisitos: [{ tipo: 'tarea', ref: 'a' }] }),
		]);
		expect(verify(dir, {}).report.inconsistencias).toEqual(
			expect.arrayContaining([
				{ id: 'a', msg: 'ciclo de requisitos' },
				{ id: 'b', msg: 'ciclo de requisitos' },
			]),
		);
	});
	it('derives the implicit check from pr and proposes comprobada for a merged «unida» task', () => {
		const dir = makeExport([
			task('olivia-gallery', { estado: 'unida', pr: '#398', rama: 'fix/olivia-gallery' }),
		]);
		const { status, report } = verify(dir, {
			'gh pr view 398 --json state': '{"state":"MERGED"}',
		});
		expect(status).toBe(0);
		expect(report.filas[0]).toMatchObject({
			veredicto: 'CUMPLE → comprobada',
			implicito: true,
		});
		expect(report.comprobar).toEqual([
			{
				id: 'olivia-gallery',
				evidencia: { cmd: 'gh pr view 398 --json state', salio: '{"state":"MERGED"}' },
			},
		]);
	});

	it('falls back to git ls-remote for a branch without PR', () => {
		const dir = makeExport([task('guest-slug', { rama: 'feat/guest-slug' })]);
		const ref = 'abc123\trefs/heads/feat/guest-slug';
		const { report } = verify(dir, { 'git ls-remote origin refs/heads/feat/guest-slug': ref });
		expect(report.filas[0]).toMatchObject({
			veredicto: 'CUMPLE (¿ya está unida?)',
			implicito: true,
		});
		expect(report.comprobar).toEqual([]);
	});

	it('reports a task with neither chequeo, pr nor rama as SIN CHEQUEO', () => {
		const dir = makeExport([task('suelta', {})]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('SIN CHEQUEO');
	});

	it('refuses an explicit chequeo outside the read-only list', () => {
		const dir = makeExport([task('mala', { chequeo: { cmd: 'git push origin develop' } })]);
		expect(verify(dir, {}).report.filas[0].veredicto).toBe('RECHAZADO');
	});

	it('lists open PRs and worktree branches that no task claims', () => {
		const dir = makeExport([task('olivia-gallery', { pr: 398 })]);
		const { report } = verify(dir, {
			'gh pr view 398 --json state': '{"state":"OPEN"}',
			'gh pr list --state open --json number,headRefName,title --limit 100': JSON.stringify([
				{ number: 398, headRefName: 'fix/olivia-gallery', title: 'Olivia' },
				{ number: 401, headRefName: 'feat/guest-slug', title: 'Guest link slug' },
			]),
			'git worktree list --porcelain': [
				'worktree D:/code/celebra-me',
				'branch refs/heads/develop',
				'',
				'worktree D:/code/wt/a',
				'branch refs/heads/feat/guest-slug',
				'',
				'worktree D:/code/wt/b',
				'branch refs/heads/chore/sin-tarea',
			].join('\n'),
		});
		expect(report.filas[0].veredicto).toBe('NO CUMPLE');
		expect(report.prsSinTarea).toEqual([
			{ pr: 401, rama: 'feat/guest-slug', titulo: 'Guest link slug' },
		]);
		expect(report.ramasSinTarea).toEqual(['chore/sin-tarea']);
	});

	it('flags open tasks whose session is archived', () => {
		const dir = makeExport(
			[
				task('america-footer', { sesion: { id: 'local_47f9', nombre: 'América' } }),
				task('viva', { rama: 'fix/viva' }),
			],
			{
				sesiones: [
					{ id: 'local_47f9', archivada: true },
					{ id: 'local_1', rama: 'fix/viva', archivada: false },
				],
			},
		);
		expect(verify(dir, {}).report.sesionArchivada).toEqual([
			{ id: 'america-footer', sesion: 'local_47f9', nombre: 'América' },
		]);
	});

	describe('lifecycle drift', () => {
		const lock = (sesion: string, carril = 'f08-demos') => ({
			agente: 'claude',
			desde: NOW,
			sesion,
			carril,
		});
		// Raw list_sessions rows, as the coordinator writes sesiones.json.
		const snapshot = [
			{ sessionId: 'local_coord', title: 'f04 · Coordinador principal', isArchived: false },
			{ sessionId: 'local_t11', title: 'f08 · T11 · Demos en usted', isArchived: false },
			{ sessionId: 'local_t30', title: 'f09 · T30 · PR #480 · Reglas', isArchived: false },
			{ sessionId: 'local_t40', title: 'f10 · T40 · Pendiente', isArchived: false },
			{ sessionId: 'local_btn', title: 'Botón para iniciar Claude Code', isArchived: false },
			{ sessionId: 'local_t99', title: 'f05 · T99 · Fantasma', isArchived: false },
			{ sessionId: 'local_old', title: 'f07 · T12 · Vieja', isArchived: true },
		];
		const tasks = [
			task('demos-usted', {
				num: 11,
				estado: 'en revision',
				pr: '#485',
				candado: lock('local_t11'),
			}),
			task('reglas', {
				num: 30,
				estado: 'en revision',
				pr: '#480',
				candado: lock('local_t30', 'f09-docs'),
			}),
			task('pendiente', { num: 40, carril: 'f10-libre', estado: 'pendiente' }),
			task('pegar', { num: 53, candado: lock('local_gone', 'f11-preview') }),
			task('logs', { num: 12, candado: lock('5f6e4a6e-interno', 'f07-x') }),
			task('suelta', { num: 60, estado: 'en curso' }),
			task('fondo', { num: 32, estado: 'unida', pr: '#470', candado: lock('local_t30') }),
		];

		it('lists sessions without a task, missing lock sessions and off-form names', () => {
			const { report } = verify(makeExport(tasks, { sesiones: snapshot }), {});
			expect(report.sesiones).toBe('VERIFIED');
			expect(report.sesionesSinTarea).toEqual([
				{ sesion: 'local_btn', nombre: 'Botón para iniciar Claude Code' },
				{ sesion: 'local_t99', nombre: 'f05 · T99 · Fantasma' },
			]);
			expect(report.candadoSinSesion.map((x: Json) => x.tarea).sort()).toEqual([
				'T12',
				'T53',
			]);
			expect(report.nombreDistinto).toEqual([
				{
					id: 'demos-usted',
					tarea: 'T11',
					sesion: 'local_t11',
					nombre: 'f08 · T11 · Demos en usted',
					msg: 'le falta «PR #485»',
				},
			]);
		});

		it('flags open tasks without a lock and merged tasks still locked', () => {
			const { report } = verify(makeExport(tasks, { sesiones: snapshot }), {
				'gh pr view 470 --json state': '{"state":"MERGED"}',
			});
			expect(report.enCursoSinSesion).toEqual([{ id: 'suelta', tarea: 'T60' }]);
			expect(report.unidasConCandado).toEqual([
				{ id: 'fondo', tarea: 'T32', carril: 'f08-demos' },
			]);
		});

		it('says the snapshot is missing and skips only the session sections', () => {
			const dir = makeExport(tasks);
			const { report } = verify(dir, {});
			expect(report.sesiones).toBe('SIN FOTO');
			expect(report.sesionesSinTarea).toEqual([]);
			expect(report.enCursoSinSesion).toHaveLength(1);
			const text = runCommand(process.execPath, [SCRIPT_PATH, dir], {
				cwd: ROOT,
				allowFailure: true,
				env: sanitizeEnv({
					CELEBRA_BOARD_COMMAND_FIXTURE: path.join(dir, 'answers.json'),
					INIT_CWD: ROOT,
				}),
			}).stdout;
			expect(text).toContain('SESIONES: no hay sesiones.json');
			expect(text).toContain('TAREAS EN CURSO SIN SESIÓN: T60');
		});

		it('reports merged branches still present and PRs closed without merge, never deleting', () => {
			const dir = makeExport([
				task('pasarela', {
					num: 19,
					estado: 'comprobada',
					rama: 'docs/pasarela',
					evidencia: { salio: 'x' },
				}),
				task('abierta', { num: 20, rama: 'docs/abierta' }),
			]);
			const closed = (head: string, rows: Json[]) => ({
				[`gh pr list --state closed --head ${head} --json number,headRefName,state --limit 100`]:
					JSON.stringify(rows),
			});
			// Old PRs on purpose: a repository-wide list of the latest 100 would miss them.
			const { report } = verify(dir, {
				'git ls-remote origin refs/heads/docs/abierta': '',
				...closed('test/baselines', [
					{ number: 33, headRefName: 'test/baselines', state: 'MERGED' },
				]),
				...closed('docs/pasarela', [
					{ number: 75, headRefName: 'docs/pasarela', state: 'CLOSED' },
				]),
				...closed('docs/abierta', [
					{ number: 76, headRefName: 'docs/abierta', state: 'CLOSED' },
				]),
				'git ls-remote --heads origin': [
					'a1\trefs/heads/develop',
					'a2\trefs/heads/docs/pasarela',
					'a3\trefs/heads/docs/abierta',
				].join('\n'),
				'git worktree list --porcelain':
					'worktree D:/wt/f08\nbranch refs/heads/test/baselines\n',
			});
			expect(report.ramasUnidasSinBorrar).toEqual([
				{ pr: 33, rama: 'test/baselines', donde: 'carril' },
			]);
			expect(report.prCerradoSinUnir).toEqual([
				{ pr: 75, rama: 'docs/pasarela', tarea: 'T19' },
			]);
			expect(report.cobertura).toMatchObject({
				prsCerrados: 'VERIFIED',
				ramasRemotas: 'VERIFIED',
			});
		});

		it('keeps closed-PR coverage UNVERIFIED when a branch query fails or hits its limit', () => {
			const dir = makeExport([task('t', {})]);
			const full = Array.from({ length: 100 }, (_, i) => ({
				number: i + 1,
				headRefName: 'feat/llena',
				state: 'CLOSED',
			}));
			const { report } = verify(dir, {
				'git ls-remote --heads origin':
					'a1\trefs/heads/feat/llena\na2\trefs/heads/feat/sin',
				'gh pr list --state closed --head feat/llena --json number,headRefName,state --limit 100':
					JSON.stringify(full),
			});
			expect(report.cobertura.prsCerrados).toBe('UNVERIFIED');
		});

		it('accepts any lane in a review session name, since reviews have no lane', () => {
			const dir = makeExport(
				[
					task('revisar', {
						num: 67,
						estado: 'en curso',
						pr: '#489',
						candado: { agente: 'claude', desde: NOW, sesion: 'local_r' },
					}),
					task('revisar-mal', {
						num: 68,
						estado: 'en curso',
						pr: '#490',
						candado: { agente: 'claude', desde: NOW, sesion: 'local_m' },
					}),
				],
				{
					sesiones: [
						{
							sessionId: 'local_r',
							title: 'f04 · T67 · PR #489 · Revisar',
							isArchived: false,
						},
						{ sessionId: 'local_m', title: 'f04 · T68 · Revisar', isArchived: false },
					],
				},
			);
			expect(verify(dir, {}).report.nombreDistinto).toEqual([
				expect.objectContaining({ tarea: 'T68', msg: 'le falta «PR #490»' }),
			]);
		});

		it('lists close-queue entries still pending after a day', () => {
			const dir = makeExport([task('t', {})]);
			mkdirSync(path.join(dir, 'cierres'));
			const entry = (tarea: string, creada: string, sesion: string) => ({
				tarea,
				creada,
				pasos: { sesion, rama: 'hecho' },
			});
			writeFileSync(
				path.join(dir, 'cierres', 'vieja.json'),
				JSON.stringify(entry('vieja', '2026-10-18T00:00:00Z', 'pendiente')),
			);
			writeFileSync(
				path.join(dir, 'cierres', 'nueva.json'),
				JSON.stringify(entry('nueva', new Date().toISOString(), 'pendiente')),
			);
			writeFileSync(
				path.join(dir, 'cierres', 'lista.json'),
				JSON.stringify(entry('lista', '2026-10-18T00:00:00Z', 'hecho')),
			);
			expect(verify(dir, {}).report.cierresPendientes).toEqual([
				{ id: 'vieja', nombre: '', pendiente: ['sesion'] },
			]);
		});
	});

	it('fails on inconsistencies and warns on decision drift, never on id/branch (d188)', () => {
		const dir = makeExport(
			[
				task('cerrada', { estado: 'comprobada', evidencia: {} }),
				task('otro-id', { rama: 'fix/rama-real', rev: 0 }),
				task('vieja', { espera: 'usted', urgencia: 'ya' }),
				task('espera', {
					requisitos: [
						{ tipo: 'tarea', ref: 'archivada' },
						{ tipo: 'decision', ref: 'd404' },
					],
				}),
			],
			{
				decisiones: [
					{ id: 'd001', vigente: false },
					{ id: 'd002', reemplaza: 'd999' },
				],
			},
		);
		const { status, report } = verify(dir, {});
		expect(status).toBe(1);
		expect(report.inconsistencias).toEqual(
			expect.arrayContaining([
				{ id: 'cerrada', msg: 'comprobada sin evidencia' },
				{ id: 'otro-id', msg: 'rev debe ser un entero desde 1' },
				{ id: 'vieja', msg: 'urgencia debe ser urgente/alta/normal/baja' },
				{ id: 'vieja', msg: 'espera y deps ya no existen: use requisitos' },
				{ id: 'd002', msg: 'reemplaza a una decisión inexistente: d999' },
			]),
		);
		expect(report.avisos).toEqual(
			expect.arrayContaining([
				{ id: 'd002', msg: 'decisión sin vigente: true|false' },
				{ id: 'espera', msg: 'requisito a una tarea fuera del tablero: archivada' },
				{ id: 'espera', msg: 'requisito a una decisión inexistente: d404' },
			]),
		);
		// d188: the id does not have to match its branch.
		expect(report.avisos.map((a: { msg: string }) => a.msg).join('\n')).not.toContain(
			'id distinto de la rama',
		);
	});

	it('warns about every open task without a planned lane, and ready ones sharing one (d177)', () => {
		const ready = (id: string, fields: Json = {}) =>
			task(id, {
				estado: 'pendiente',
				prompt: `Task ${id}.
DECISIONES
- none`,
				...fields,
			});
		const dir = makeExport(
			[
				ready('sin-carril', { num: 30 }),
				ready('uno', { carrilPlaneado: 'f10-libre' }),
				ready('dos', { carrilPlaneado: 'f10-libre' }),
				ready('sola', { carrilPlaneado: 'f12-release' }),
				ready('rara', { carrilPlaneado: 'f13-nuevo' }),
				ready('del-coordinador', { actor: 'coordinador' }),
				ready('del-dueno', { actor: 'dueno' }),
				// The lane its lock holds is where it runs.
				ready('apartada', { candado: { agente: 'codex', desde: NOW, carril: 'f09-docs' } }),
				task('en-curso', {}),
				ready('bloqueada', { requisitos: [{ tipo: 'dueno', ref: 'Elegir' }] }),
				// Reviews run read-only in Integration; finished tasks no longer run.
				ready('uno-revision', { requisitos: [{ tipo: 'revision', ref: 'uno' }] }),
				task('terminada', { estado: 'hecha' }),
				// Ready because its prerequisite is archived as done, so it needs a lane too.
				ready('tras-archivada', { requisitos: [{ tipo: 'tarea', ref: 'archivada' }] }),
			],
			{ archivo: [{ id: 'archivada', estado: 'hecha' }] },
		);
		const { report } = verify(dir, {});
		const lanes = report.avisos.filter((a: { msg: string }) => /carril/.test(a.msg));
		// The export numbers every task, so each warning names its T<n>.
		const missing = (id: string, num = String.raw`T\d+`) => ({
			id,
			msg: expect.stringMatching(
				new RegExp(
					`^${num} sin carril planeado: pnpm board plan ${id} --rev=1 --carril=<carril> --coordinador$`,
				),
			),
		});
		const shared = 'carril f10-libre planeado para 2 tareas listas: ';
		expect(lanes).toHaveLength(8);
		expect(lanes).toEqual(
			expect.arrayContaining([
				missing('sin-carril', 'T30'),
				missing('del-coordinador'),
				missing('del-dueno'),
				missing('en-curso'),
				missing('bloqueada'),
				missing('tras-archivada'),
				{ id: 'uno', msg: expect.stringContaining(shared) },
				{ id: 'dos', msg: expect.stringContaining(shared) },
			]),
		);
		expect(report.inconsistencias).toContainEqual({
			id: 'rara',
			msg: 'carril planeado no canónico: f13-nuevo',
		});
	});

	it('accepts Integration only for coordinator tasks and calls a 10 h lock old, like the sync', () => {
		const desde = new Date(Date.now() - 10 * 3_600_000).toISOString();
		const dir = makeExport([
			task('de-sesion', { estado: 'pendiente', carrilPlaneado: 'integration' }),
			task('de-coordinador', {
				estado: 'pendiente',
				actor: 'coordinador',
				carrilPlaneado: 'integration',
			}),
			task('con-candado', { candado: { agente: 'codex', desde } }),
		]);
		const { report } = verify(dir, {});
		expect(report.inconsistencias).toContainEqual({
			id: 'de-sesion',
			msg: 'carril planeado no canónico: integration',
		});
		expect(report.inconsistencias.map((i: { id: string }) => i.id)).not.toContain(
			'de-coordinador',
		);
		expect(report.avisos).toContainEqual({
			id: 'con-candado',
			msg: `candado de codex desde ${desde}: ¿sigue trabajando?`,
		});
	});

	it('warns about finished, unarchived tasks without a valid closing summary (d178)', () => {
		const cierre = {
			resumen: 'Hecho.',
			comprobaciones: [],
			saltadas: [],
			pendientes: [{ texto: 'Segunda vuelta', tarea: 'T58' }],
			en: NOW,
		};
		const dir = makeExport([
			task('sin-cierre', { estado: 'unida', pr: '#12' }),
			task('archivada', { estado: 'comprobada', archivada: NOW, evidencia: { salio: 'x' } }),
			task('con-cierre', { estado: 'cancelada', cierre }),
			task('huerfano', {
				estado: 'cancelada',
				cierre: { ...cierre, pendientes: [{ texto: 'X', tarea: 'T99' }] },
			}),
			task('siguiente', { num: 58 }),
		]);
		const { report } = verify(dir, { 'gh pr view 12 --json state': '{"state":"MERGED"}' });
		const msgs = report.avisos.filter((a: { msg: string }) => /cierre/.test(a.msg));
		expect(msgs).toHaveLength(2);
		expect(msgs).toEqual(
			expect.arrayContaining([
				{
					id: 'sin-cierre',
					msg: 'finalizada sin resumen de cierre: pnpm board close sin-cierre --resumen=… --coordinador',
				},
				{
					id: 'huerfano',
					msg: 'cierre incompleto (el pendiente «X» apunta a T99, que no está en el tablero): pnpm board close huerfano --resumen=… --coordinador',
				},
			]),
		);
	});
});

describe('prompt lane (H13)', () => {
	it('warns when the prompt «DÓNDE CORRE» names a lane other than the planned one', () => {
		const prompt = (lane: string) =>
			`QUÉ SE BUSCA\nVer f09-docs.\n\nDÓNDE CORRE\nSesión en el carril ${lane}.\n\nAUTORIZO\nNada.`;
		const dir = makeExport([
			task('distinto', {
				estado: 'pendiente',
				carrilPlaneado: 'f12-release',
				prompt: prompt('f06-landing'),
			}),
			task('igual', {
				estado: 'pendiente',
				carrilPlaneado: 'f06-landing',
				prompt: prompt('f06-landing'),
			}),
			task('sin-seccion', {
				estado: 'pendiente',
				carrilPlaneado: 'f06-landing',
				prompt: 'Corre en f07-invitaciones.',
			}),
		]);
		const { report } = verify(dir, {});
		const msgs = report.avisos.filter((a: { msg: string }) => /el prompt dice/.test(a.msg));
		expect(msgs).toEqual([
			{ id: 'distinto', msg: 'T1 el prompt dice f06-landing, pero corre en f12-release' },
			{
				id: 'sin-seccion',
				msg: 'T3 el prompt dice f07-invitaciones, pero corre en f06-landing',
			},
		]);
	});
});
