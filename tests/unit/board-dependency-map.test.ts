import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { sanitizeEnv } from '../helpers/run-command';

function probe(source: string) {
	const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
		cwd: process.cwd(),
		encoding: 'utf8',
		timeout: 15_000,
		env: sanitizeEnv(),
	});
	expect(r.stderr).toBe('');
	expect(r.status).toBe(0);
	return JSON.parse(r.stdout);
}

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A board store on disk with one task kept only in the monthly .zip and one compacted to archivo/. */
function storeWithZip() {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-map-'));
	dirs.push(dir);
	const doc = (collection: string, id: string, data: object) => {
		mkdirSync(path.join(dir, collection), { recursive: true });
		writeFileSync(path.join(dir, collection, `${id}.json`), JSON.stringify(data));
	};
	doc('tareas', 'waits-zip', {
		num: 10,
		titulo: 'Waits zip',
		estado: 'pendiente',
		prompt: 'p',
		requisitos: [{ tipo: 'tarea', ref: 'zipped' }],
	});
	doc('tareas', 'waits-archived', {
		num: 11,
		titulo: 'Waits archived',
		estado: 'pendiente',
		prompt: 'p',
		requisitos: [{ tipo: 'tarea', ref: 'compacted' }],
	});
	doc('archivo', 'compacted', { num: 2, titulo: 'Compacted', estado: 'unida' });
	const entry = JSON.stringify({
		num: 1,
		titulo: 'Zipped',
		estado: 'hecha',
		archivada: '2026-09-02T00:00:00Z',
	});
	probe(`
		import { writeZip } from './scripts/board/zip.mjs';
		import path from 'node:path';
		writeZip(path.join(${JSON.stringify(dir)},'mensual','2026-09.zip'),[{name:'tareas/zipped.json',data:${JSON.stringify(entry)}}]);
		console.log('null');
	`);
	return dir;
}

describe('board dependency map (T471)', () => {
	it('counts a requisito to a task in archivo/ or only in a monthly .zip as done', () => {
		const dir = storeWithZip();
		const r = probe(`
			import { loadBoard } from './scripts/board/store.mjs';
			import { requisitos, stage } from './scripts/board/model.mjs';
			import { requisitoText } from './scripts/board/requisito-text.mjs';
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			const b=loadBoard(${JSON.stringify(dir)});
			const g=dependencyGraph(b);
			const t=id=>b.tareas.find(x=>x.id===id);
			console.log(JSON.stringify({
				zip:b.archivoZip,
				ok:['waits-zip','waits-archived'].map(id=>requisitos(t(id),b).every(r=>r.ok)),
				stage:['waits-zip','waits-archived'].map(id=>stage(t(id),b)),
				text:requisitoText({tipo:'tarea',ref:'zipped'},b),
				gray:g.nodos.filter(n=>n.tipo==='hecha').map(n=>n.id).sort(),
				avisos:g.avisos,
			}));
		`);
		expect(r).toEqual({
			zip: [
				{
					id: 'zipped',
					num: 1,
					titulo: 'Zipped',
					estado: 'hecha',
					archivada: '2026-09-02T00:00:00Z',
					zip: 'mensual/2026-09.zip',
				},
			],
			ok: [true, true],
			stage: ['lista', 'lista'],
			text: 'Termina T1 · Zipped (archivada)',
			gray: ['compacted', 'zipped'],
			avisos: [],
		});
	});

	it('leaves archivoZip out when every requisito resolves without the .zip', () => {
		const r = probe(`
			import { zipOnlyTasks } from './scripts/board/store.mjs';
			console.log(JSON.stringify(zipOnlyTasks('does-not-exist',[{id:'a',padre:'b',requisitos:[{tipo:'tarea',ref:'b'}]}],[{id:'b'}])));
		`);
		expect(r).toEqual([]);
	});

	it('lays chains out in columns, counts «desbloquea» and roots owner steps in red', () => {
		const r = probe(`
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			const task=(id,num,extra={})=>({id,num,titulo:id,estado:'pendiente',prompt:'p',...extra});
			const board={decisiones:[{id:'d9',vigente:false,decision:'Choose the provider'}],archivo:[],tareas:[
				task('pay',1,{requisitos:[{tipo:'dueno',ref:'confirmar pago'}]}),
				task('build',2,{requisitos:[{tipo:'tarea',ref:'pay'}]}),
				task('ship',3,{requisitos:[{tipo:'tarea',ref:'build'}]}),
				task('docs',4,{requisitos:[{tipo:'tarea',ref:'build'},{tipo:'decision',ref:'d9'}]}),
				task('alone',5),
			]};
			const g=dependencyGraph(board);
			console.log(JSON.stringify({
				ids:g.nodos.map(x=>x.id),
				capa:Object.fromEntries(g.nodos.map(x=>[x.id,x.capa])),
				desbloquea:Object.fromEntries(g.nodos.map(x=>[x.id,x.desbloquea])),
				roots:g.nodos.filter(x=>x.tipo==='raiz').map(x=>x.texto).sort(),
				edges:g.aristas.map(e=>e.de+'>'+e.a),
				abiertas:g.abiertas,
			}));
		`);
		expect(r.ids).not.toContain('alone');
		expect(r.capa).toEqual({
			'raiz:dueno:pay:confirmar pago': 0,
			'raiz:decision:d9': 0,
			pay: 1,
			build: 2,
			ship: 3,
			docs: 3,
		});
		expect(r.desbloquea).toEqual({
			'raiz:dueno:pay:confirmar pago': 4,
			'raiz:decision:d9': 1,
			pay: 3,
			build: 2,
			ship: 0,
			docs: 0,
		});
		expect(r.roots).toEqual([
			'Usted: confirmar pago',
			'Usted: decidir d9: Choose the provider',
		]);
		expect(r.edges).toEqual([
			'pay>raiz:dueno:pay:confirmar pago',
			'build>pay',
			'ship>build',
			'docs>build',
			'docs>raiz:decision:d9',
		]);
		expect(r.abiertas).toBe(4);
	});

	it('warns about a cycle and about a requisito to a task that does not exist', () => {
		const r = probe(`
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			const task=(id,num,refs)=>({id,num,titulo:id,estado:'pendiente',prompt:'p',requisitos:refs.map(ref=>({tipo:'tarea',ref}))});
			const g=dependencyGraph({decisiones:[],archivo:[],tareas:[task('a',1,['b']),task('b',2,['c']),task('c',3,['a']),task('d',4,['ghost'])]});
			console.log(JSON.stringify({avisos:g.avisos.map(a=>[a.tipo,a.texto]),capa:g.nodos.map(n=>n.id+':'+n.capa),edges:g.aristas.length}));
		`);
		expect(r.avisos).toEqual([
			['ref', 'T4 espera «ghost», que no existe en el tablero'],
			['ciclo', 'Ciclo: T1 → T2 → T3 se esperan entre sí; ninguna puede empezar'],
		]);
		expect(r.capa).toEqual(['a:0', 'b:0', 'c:0']);
		expect(r.edges).toBe(3);
	});

	it('groups open subtasks right of their mother and drops a mother with no open subtask', () => {
		const r = probe(`
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			const task=(id,num,extra={})=>({id,num,titulo:id,estado:'pendiente',prompt:'p',...extra});
			const g=dependencyGraph({decisiones:[],archivo:[{id:'old-mother',num:9,titulo:'Old',estado:'unida'}],tareas:[
				task('mother',1,{grupo:'mother'}),
				task('child-a',2,{grupo:'mother'}),
				task('child-b',3,{grupo:'mother',requisitos:[{tipo:'tarea',ref:'child-a'}]}),
				task('lonely',4,{grupo:'lonely'}),
				task('done-child',5,{padre:'lonely',estado:'hecha'}),
				task('orphan',6,{padre:'old-mother'}),
			]});
			console.log(JSON.stringify(g.nodos.map(n=>[n.id,n.tipo,n.capa,n.madre??null])));
		`);
		expect(r).toEqual([
			['mother', 'tarea', 0, null],
			['old-mother', 'hecha', 0, null],
			['child-a', 'tarea', 1, 'mother'],
			['orphan', 'tarea', 1, 'old-mother'],
			['child-b', 'tarea', 2, 'mother'],
		]);
	});

	it('keeps columns tight when a mother waits on its own subtasks', () => {
		const r = probe(`
			import { dependencyGraph } from './scripts/board/dependency-graph.mjs';
			const task=(id,num,extra={})=>({id,num,titulo:id,estado:'pendiente',prompt:'p',...extra});
			const g=dependencyGraph({decisiones:[],archivo:[],tareas:[
				task('m',1,{grupo:'m',requisitos:[{tipo:'tarea',ref:'a'},{tipo:'tarea',ref:'b'}]}),
				task('a',2,{grupo:'m'}),
				task('b',3,{grupo:'m'}),
			]});
			console.log(JSON.stringify({capa:g.nodos.map(n=>n.id+':'+n.capa),avisos:g.avisos}));
		`);
		expect(r).toEqual({ capa: ['a:0', 'b:0', 'm:1'], avisos: [] });
	});

	it('lists blocked tasks with no unmet requisito as «bloqueadas sin motivo» and ships the map in the payload', () => {
		const r = probe(`
			import { liveBoard } from './scripts/board/view-payload.mjs';
			const now=Date.parse('2026-10-29T12:00:00Z');
			const board={decisiones:[],archivo:[{id:'gone',estado:'unida'}],bitacora:[],tareas:[
				{id:'stuck',num:1,titulo:'Stuck',estado:'bloqueada'},
				{id:'met',num:2,titulo:'Met',estado:'bloqueada',requisitos:[{tipo:'tarea',ref:'gone'}]},
				{id:'waiting',num:3,titulo:'Waiting',estado:'bloqueada',requisitos:[{tipo:'fecha',ref:'2026-12-01T00:00:00Z'}]},
				{id:'owner',num:4,titulo:'Owner',estado:'bloqueada',requisitos:[{tipo:'dueno',ref:'answer'}]},
			]};
			console.log(JSON.stringify(liveBoard(board,now).mapa.bloqueadasSinMotivo.map(t=>t.id)));
		`);
		expect(r).toEqual(['stuck', 'met']);
	});
});
