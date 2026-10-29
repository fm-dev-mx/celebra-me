import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/external-sessions.mjs')).href;
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function probe(code: string) {
	const dir = mkdtempSync(path.join(tmpdir(), 'board-archive-'));
	dirs.push(dir);
	const r = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		const m=await import(process.argv[1]); const dir=process.argv[2]; ${code}`,
			MODULE,
			dir,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(r.stdout);
}

describe('live archive recommendations', () => {
	it('requires merged PR evidence, excludes masters and open reviews, and keeps each identity', () => {
		const result = probe(`
			const b={tareas:[
				{id:'done',num:1,estado:'hecha',pr:'#1'},
				{id:'unmerged',num:2,estado:'unida',pr:'#2'},
				{id:'review-revision',num:3,estado:'hecha',revisionSha:'abc',pr:'#2'},
				{id:'open-revision',num:4,estado:'en revision',revisionSha:'abc'},
				{id:'locked',num:5,estado:'hecha',candado:{agente:'codex'}},
				{id:'plain',num:6,estado:'hecha'}],archivo:[]};
			const rows=[{id:'a',titulo:'f11 · T1 · Done'},{id:'b',titulo:'f11 · T2 · Pending PR'},
				{id:'c',titulo:'f04 · T3 · Review'},{id:'d',titulo:'f04 · T4 · Open review'},
				{id:'e',titulo:'f04 · T5 · Locked'},{id:'f',titulo:'f04 · T6 · Plain'},
				{id:'g',titulo:'f04 · Despachador Codex'},{id:'master',titulo:'f04 · Despachador Codex'},
				{id:'h',titulo:'f04 · Codex maestro'},{id:'i',titulo:'f11 · T1 · Done'},
				{id:'j',titulo:'f11 · T1 · Archived',archivado:true}];
			console.log(JSON.stringify(m.archiveCandidates('codex',rows,b,{masters:{codex:'master'}},{'#1':'MERGED','#2':'OPEN'})));`);
		expect(result.map((r: { id: string }) => r.id)).toEqual(['a', 'c', 'f', 'g', 'i']);
	});

	it('degrades unavailable stores independently and uses board-registered Claude sessions', () => {
		const result = probe(`
			const b={tareas:[{id:'done',num:1,estado:'hecha',sesion:{agente:'claude',id:'claude-chat',nombre:'f04 · T1 · Done'}}],archivo:[]};
			console.log(JSON.stringify(await m.archiveSessions(b,{dir,config:{},read:async(agent)=>agent==='codex'?{error:'busy'}:{rows:[]},readPr:()=>{throw Error('no PR expected')}})));`);
		expect(result.fuentes.codex).toMatchObject({ disponible: false });
		expect(result.chats).toEqual([
			expect.objectContaining({ id: 'claude-chat', agente: 'claude' }),
		]);
	});

	it('removes Claude recommendations only after explicit archival confirmation and protects masters', () => {
		const result = probe(`
			const {setMaster,confirmClaudeArchive,readLocal,masterConfigPath}=await import(new URL('./master-config.mjs',process.argv[1]));
			setMaster(dir,'claude','master');
			let refused=false;try{confirmClaudeArchive(dir,'master')}catch{refused=true}
			confirmClaudeArchive(dir,'closed');
			const config=readLocal(masterConfigPath(dir));
			const b={tareas:[{id:'done',num:1,estado:'hecha'}],archivo:[]};
			const chats=m.archiveCandidates('claude',[{id:'closed',titulo:'f04 · T1 · Done'}],b,config);
			console.log(JSON.stringify({refused,chats}));`);
		expect(result).toEqual({ refused: true, chats: [] });
	});

	it('pushes refreshed inventories over the existing SSE connection without page reload', () => {
		const result = probe(`
			import { get } from 'node:http';
			const {serveView}=await import(new URL('./view-server.mjs',process.argv[1]));
			let generation=0;
			const server=await serveView(dir,0,{sessionsMs:30,sessions:async()=>({chats:[{id:'chat-'+(++generation)}]})});
			const seen=[];
			await new Promise((ok,fail)=>{
				const timeout=setTimeout(()=>fail(Error('SSE did not refresh')),3000);
				const req=get({host:'127.0.0.1',port:server.address().port,path:'/api/stream'},res=>{
					let buffer='';res.on('data',chunk=>{buffer+=chunk;let at;
						while((at=buffer.indexOf('\\n\\n'))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);
							if(frame.startsWith('data: ')){const data=JSON.parse(frame.slice(6));if(data.archivables)seen.push(data.archivables.chats[0].id);}
						}
						if(new Set(seen).size>=2){clearTimeout(timeout);req.destroy();ok();}
					});
				});req.on('error',fail);
			});
			server.drain();console.log(JSON.stringify({seen}));`);
		expect(new Set(result.seen).size).toBeGreaterThanOrEqual(2);
	});

	it('renders fixture recommendations safely and replaces stale rows on refresh', () => {
		const view = readFileSync(path.join(ROOT, 'scripts/board/view.html'), 'utf8');
		const fn = /function renderArchiveChats\(\)\{([\s\S]*?)\n\}/.exec(view)?.[1];
		expect(fn).toBeDefined();
		document.body.innerHTML = '<span id="gn-archive"></span><div id="archive-chats"></div>';
		const board = {
			archivables: {
				chats: [
					{
						agente: 'codex',
						id: 'a',
						titulo: '<img src=x onerror=alert(1)>',
						motivo: 'PR unido',
					},
				],
			},
		};
		const esc = (value: unknown) =>
			String(value).replace(
				/[&<>"']/g,
				(c) =>
					({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ??
					c,
			);
		const render = new Function('S', '$', 'esc', 'AGENT_REGISTRY', fn ?? '');
		const draw = () =>
			render({ board }, (id: string) => document.getElementById(id), esc, {
				codex: { nombre: 'Codex' },
			});
		draw();
		expect(document.querySelector('img')).toBeNull();
		expect(document.getElementById('archive-chats')?.textContent).toContain('<img');
		board.archivables.chats = [];
		draw();
		expect(document.getElementById('gn-archive')?.textContent).toBe('0');
		expect(document.getElementById('archive-chats')?.textContent).toContain('No hay chats');
	});
});
