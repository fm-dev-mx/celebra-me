import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
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

describe('light board view payload', () => {
	it('bounds live history without hiding unanswered messages, handling receipts or related archives', () => {
		const r = probe(`
			import { liveBoard } from './scripts/board/view-payload.mjs';
			import { ownerMessages } from './scripts/board/next.mjs';
			import { requisitos } from './scripts/board/model.mjs';
			const now=Date.parse('2026-10-26T12:00:00Z');
			const bitacora=Array.from({length:400},(_,i)=>({en:new Date(now-400000+i*1000).toISOString(),corrio:'row-'+i}));
			bitacora[0].mensaje={id:'pending',para:'dueno',texto:'Pending'};bitacora[0].tarea='open';
			bitacora[1].mensaje={id:'handled',para:'dueno',texto:'Handled'};bitacora[1].tarea='open';
			bitacora[2].atendido={para:'dueno',mensajes:['handled']};
			const board={tareas:[{id:'open',estado:'pendiente',actor:'sesion',prompt:'full',grupo:'group',requisitos:[{tipo:'revision',ref:'reviewed'}]}],archivo:[{id:'reviewed',estado:'unida',pr:'#1'},{id:'sibling',estado:'hecha',grupo:'group'},{id:'unrelated',estado:'hecha'}],decisiones:[],bitacora};
			const small=liveBoard(board,now);
			console.log(JSON.stringify({rows:small.bitacora.length,receipts:small.bitacora.filter(r=>r.atendido).length,messages:ownerMessages(small).map(r=>r.mensaje.id),references:small.archivo.map(t=>t.id),revision:requisitos(small.tareas[0],small).every(r=>r.ok)}));
		`);
		expect(r).toEqual({
			rows: 202,
			receipts: 1,
			messages: ['pending'],
			references: ['reviewed', 'sibling'],
			revision: true,
		});
	});

	it('preserves readiness, archived dependencies, review verdicts and archive eligibility', () => {
		const r = probe(`
			import { liveBoard } from './scripts/board/view-payload.mjs';
			import { requisitos } from './scripts/board/model.mjs';
			import { readyToMerge } from './scripts/board/next.mjs';
			import { ownerActions } from './scripts/board/format.mjs';
			const now=Date.parse('2026-10-26T12:00:00Z');
			const cierre={resumen:'Listo. '+ 'evidence '.repeat(30000),en:new Date(now).toISOString(),comprobaciones:['checks '.repeat(30000)],saltadas:[],pendientes:[]};
			const archived={id:'done',num:1,titulo:'Done',estado:'hecha',archivada:'2026-10-20T00:00:00Z',cierre};
			const origin={id:'origin',num:3,titulo:'Origin',estado:'en revision',pr:'#42',cierre:{...cierre,resumen:'Listo.'}};
			const round={id:'origin-revision',num:4,titulo:'Review',estado:'hecha',origen:'origin',revisionSha:'a'.repeat(40),archivada:'2026-10-22T00:00:00Z',cierre:{...cierre,resultado:{veredicto:'aprobado',sha:'a'.repeat(40),hallazgos:[]}}};
			const board={tareas:[archived,{id:'open',num:2,titulo:'Open',estado:'pendiente',actor:'sesion',prompt:'secret '.repeat(60000),requisitos:[{tipo:'tarea',ref:'done'}]},origin,round,{id:'finished',num:5,estado:'hecha',cierre:{...cierre,resumen:'Listo.'}},{id:'invalid',num:6,estado:'hecha'}],archivo:[],decisiones:[],agentes:[],carriles:[],bitacora:[{en:'2026-10-23T11:59:59Z'},{en:'2026-10-23T12:00:00Z'}]};
			const small=liveBoard(board,now);
			console.log(JSON.stringify({bytes:Buffer.byteLength(JSON.stringify(small)),ids:small.tareas.map(t=>t.id),prompt:small.tareas[0].prompt,checks:small.tareas[1].cierre.comprobaciones,ready:requisitos(small.tareas[0],small).every(r=>r.ok),merge:readyToMerge(origin,small)?.id,logs:small.bitacora.length,unchanged:board.tareas[1].prompt.length>100000,archiveBefore:ownerActions(board,{now}).filter(x=>x.tipo==='archivar').map(x=>x.n),archiveAfter:ownerActions(small,{now}).filter(x=>x.tipo==='archivar').map(x=>x.n)}));
		`);
		expect(r).toMatchObject({
			ids: ['open', 'origin', 'finished', 'invalid'],
			prompt: true,
			ready: true,
			merge: 'origin-revision',
			logs: 1,
			unchanged: true,
		});
		expect(r).not.toHaveProperty('checks');
		expect(r.bytes).toBeLessThan(300_000);
		expect(r.archiveAfter).toEqual(r.archiveBefore);
	});

	it('serves full details on demand and reflects archive/unarchive, ignoring backup events', () => {
		const r = probe(`
			import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
			import { tmpdir } from 'node:os';import { join } from 'node:path';import { EventEmitter } from 'node:events';
			import { serveView } from './scripts/board/view-server.mjs';
			import { viewArchiver } from './scripts/board/board.mjs';
			const dir=mkdtempSync(join(tmpdir(),'board-light-'));mkdirSync(join(dir,'tareas'));
			const task={id:'done',num:1,titulo:'Done',estado:'hecha',rev:1,prompt:'FULL PROMPT',cierre:{resumen:'Done.',en:new Date().toISOString(),comprobaciones:['FULL CHECKS'],saltadas:[],pendientes:[]}};
			const write=t=>writeFileSync(join(dir,'tareas/done.json'),JSON.stringify(t));write(task);
			mkdirSync(join(dir,'bitacora'));
			writeFileSync(join(dir,'bitacora',new Date().toISOString().slice(0,10)+'.jsonl'),Array.from({length:240},(_,i)=>JSON.stringify({en:new Date().toISOString(),corrio:'row-'+i})).join('\\n')+'\\n');
			let changed;const watcher=new EventEmitter();watcher.close=()=>{};
			const server=await serveView(dir,0,{archive:viewArchiver(dir),watchFactory:(_dir,_opts,cb)=>{changed=cb;return watcher},settleMs:10,reconcileMs:60000});
			const base='http://127.0.0.1:'+server.address().port;
			const get=async p=>{const r=await fetch(base+p);return {status:r.status,body:await r.json()}};
			const wait=()=>new Promise(r=>setTimeout(r,50));
			try{
				const initial=await get('/api/board'),detail=await get('/api/task?id=done'),missing=await get('/api/task?id=missing'),history=await get('/api/history');
				write({...task,titulo:'Changed'});changed('change','.respaldos/tareas/done/1.json');await wait();
				const ignored=(await get('/api/board')).body.tareas[0].titulo==='Done';
				changed('change','tareas/done.json');await wait();
				const updated=(await get('/api/board')).body.tareas[0].titulo==='Changed';
				const post=async(archivar,rev)=>(await fetch(base+'/api/archivar',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({id:'done',archivar,rev})})).status;
				const archived=await post(true,1);changed('change','tareas/done.json');await wait();
				const hidden=(await get('/api/board')).body.tareas.length===0,archiveList=await get('/api/archivadas');
				const stale=await post(false,1),restored=await post(false,2);changed('change','tareas/done.json');await wait();
				const visible=(await get('/api/board')).body.tareas.length===1;
				writeFileSync(join(dir,'.lock'),'busy');const locked=await get('/api/task?id=done');
				console.log(JSON.stringify({summary:initial.body.tareas[0],liveRows:initial.body.bitacora.length,historyRows:history.body.bitacora.length,detail:detail.body,missing:missing.status,ignored,updated,archived,hidden,archiveList:archiveList.body,stale,restored,visible,locked:locked.status}));
			}finally{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})}
		`);
		expect(r.summary.prompt).toBe(true);
		expect(r.liveRows).toBe(200);
		expect(r.historyRows).toBe(240);
		expect(r.summary.cierre).not.toHaveProperty('comprobaciones');
		expect(r.detail).toMatchObject({
			prompt: 'FULL PROMPT',
			cierre: { comprobaciones: ['FULL CHECKS'] },
		});
		expect(r.archiveList[0].cierre.comprobaciones).toEqual(['FULL CHECKS']);
		expect(r).toMatchObject({
			missing: 404,
			ignored: true,
			updated: true,
			archived: 200,
			hidden: true,
			stale: 409,
			restored: 200,
			visible: true,
			locked: 503,
		});
	});

	it('skips old daily log files while full command reads remain unchanged', () => {
		const r = probe(`
			import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
			import { readLog } from './scripts/board/store.mjs';
			const dir=mkdtempSync(join(tmpdir(),'board-log-'));mkdirSync(join(dir,'bitacora'));
			try{writeFileSync(join(dir,'bitacora/2026-10-01.jsonl'),JSON.stringify({en:'2026-10-01T00:00:00Z'}));writeFileSync(join(dir,'bitacora/2026-10-23.jsonl'),[{en:'2026-10-23T11:59:59Z'},{en:'2026-10-23T12:00:00Z'}].map(x=>JSON.stringify(x)).join('\\n'));
			const full=readLog(dir).length;writeFileSync(join(dir,'bitacora/2026-10-01.jsonl'),'invalid old file');console.log(JSON.stringify({full,recent:readLog(dir,{since:Date.parse('2026-10-23T12:00:00Z')}).length}));}finally{rmSync(dir,{recursive:true,force:true})}
		`);
		expect(r).toEqual({ full: 3, recent: 1 });
	});

	it('fetches full prompts, invalidates detail revisions and rejects stale responses before copying', async () => {
		const html = readFileSync(path.join(process.cwd(), 'scripts/board/view.html'), 'utf8');
		const source = html.slice(html.indexOf('const DETAILS='), html.indexOf('const decById='));
		const state = { board: { tareas: [{ id: 'open', rev: 1, prompt: true }] } };
		let calls = 0;
		const fetcher = async () => {
			calls++;
			return {
				ok: true,
				json: async () => ({ id: 'open', rev: calls === 1 ? 1 : 2, prompt: 'FULL PROMPT' }),
			};
		};
		const client = new Function('S', '$', 'fetch', source + ';return {readTask,fullTask};')(
			state,
			() => ({ checked: false }),
			fetcher,
		);
		expect((await client.readTask('open')).prompt).toBe('FULL PROMPT');
		await client.readTask('open');
		expect(calls).toBe(1);
		state.board.tareas[0].rev = 3;
		expect(client.fullTask(state.board.tareas[0])).toBeNull();
		await expect(client.readTask('open')).rejects.toThrow('La tarea cambió');
	});
});
