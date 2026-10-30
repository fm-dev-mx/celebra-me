import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { runCommand, sanitizeEnv } from '../helpers/run-command';

const ROOT = process.cwd();
const MODULE = pathToFileURL(path.join(ROOT, 'scripts/board/master-watch.mjs')).href;
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function fixture() {
	const root = mkdtempSync(path.join(tmpdir(), 'board-master-'));
	dirs.push(root);
	const dir = path.join(root, 'board');
	mkdirSync(path.join(dir, 'tareas'), { recursive: true });
	writeFileSync(
		path.join(dir, 'tareas', 'ready.json'),
		JSON.stringify({
			id: 'ready',
			num: 435,
			estado: 'pendiente',
			agente: 'codex',
			actor: 'sesion',
			requisitos: [],
			prompt: 'fixture',
			rev: 1,
		}),
	);
	return { root, dir };
}
function probe(code: string, root: string) {
	const result = runCommand(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			`
		import { readFileSync, writeFileSync, existsSync } from 'node:fs';
		import { join } from 'node:path';
		const m = await import(process.argv[1]); const root = process.argv[2];
		const dir = join(root, 'board');
		const { setMaster } = await import(new URL('./master-config.mjs', process.argv[1]));
		${code}`,
			MODULE,
			root,
		],
		{ cwd: ROOT, env: sanitizeEnv({}) },
	);
	return JSON.parse(result.stdout);
}

describe('master watcher (d351)', () => {
	it('is silent without configuration or work and never invokes transport in dry-run', () => {
		const { root } = fixture();
		const result = probe(
			`
			let calls=0; const deliver=()=>calls++;
			const getArchives=async()=>({chats:[]});
			// Owner Telegram alerts (T437) keep their own receipts; board-owner-alerts.test.ts covers them.
			const ownerAlerts=async()=>[];
			const unconfigured=await m.runMasterWatch({dir,deliver,getArchives,ownerAlerts});
			setMaster(dir,'codex','master-one');
			const printed=[];
			await m.runMasterWatch({dir,deliver,getArchives,ownerAlerts,dryRun:true,out:t=>printed.push(t)});
			const saved=existsSync(join(root,'board-master-watch.json'));
			writeFileSync(join(dir,'tareas','ready.json'),JSON.stringify({id:'ready',estado:'hecha'}));
			const empty=await m.runMasterWatch({dir,deliver,getArchives,ownerAlerts});
			console.log(JSON.stringify({unconfigured,empty,calls,saved,printed}));`,
			root,
		);
		expect(result).toMatchObject({ unconfigured: [], empty: [], calls: 0, saved: false });
		expect(result.printed).toHaveLength(1);
	});

	it('finishes the pass and delivers wakes when the Telegram send hangs, without leaking the token', () => {
		const { root } = fixture();
		const token = '123456789:fake-token-for-tests-only-0000000000';
		const result = probe(
			`
			setMaster(dir,'codex','master-one');
			writeFileSync(join(root,'telegram.json'),JSON.stringify({token:'${token}',chatId:'9'}));
			const { checkOwnerAlerts } = await import(new URL('./owner-alerts.mjs', process.argv[1]));
			const tg = await import(new URL('./telegram.mjs', process.argv[1]));
			// The interval stands in for the open socket that keeps a real hung fetch alive.
			const hanging = (_url, init) => new Promise((_, reject) => {
				const socket = setInterval(() => {}, 1000);
				init.signal.addEventListener('abort', () => { clearInterval(socket); reject(init.signal.reason); });
			});
			const ownerAlerts = (args) => checkOwnerAlerts({ ...args,
				sendTelegram: (text, opts) => tg.sendTelegramAlert(text, { ...opts, fetch: hanging, timeoutMs: 50 }) });
			const woken=[]; const printed=[];
			const started=Date.now();
			await m.runMasterWatch({dir,getArchives:async()=>({chats:[]}),deliver:(...a)=>woken.push(a[0]),ownerAlerts,out:t=>printed.push(t)});
			const ms=Date.now()-started;
			const read=(f)=>existsSync(join(root,f))?readFileSync(join(root,f),'utf8'):'';
			console.log(JSON.stringify({woken,ms,log:read('board-master-watch.log'),saved:read('board-master-watch.json'),printed}));`,
			root,
		);
		expect(result.woken).toEqual(['codex']);
		expect(result.ms).toBeLessThan(5000);
		expect(result.log).toContain('timeout');
		for (const text of [result.log, result.saved, result.printed.join('\n')])
			expect(text).not.toContain(token);
	});

	it('retries a failed fake queue, remembers acceptance across restarts, and re-arms readiness', () => {
		const { root } = fixture();
		const result = probe(
			`
			setMaster(dir,'codex','master-one');
			const getArchives=async()=>({chats:[]}); let calls=0;
			try { await m.runMasterWatch({dir,getArchives,deliver:()=>{calls++;throw Error('offline')}}); } catch {}
			const deliver=(...args)=>m.deliverWake(...args, (command,argv)=>{
				if(command!=='codex.exe'||argv[0]!=='queue'||argv[1]!=='--thread'||argv[2]!=='master-one')throw Error('bad queue args');
				writeFileSync(join(root,'queue.json'),JSON.stringify(argv));calls++;
			});
			await m.runMasterWatch({dir,getArchives,deliver});
			await m.runMasterWatch({dir,getArchives,deliver});
			const task=JSON.parse(readFileSync(join(dir,'tareas','ready.json')));
			writeFileSync(join(dir,'tareas','ready.json'),JSON.stringify({...task,estado:'en curso'}));
			await m.runMasterWatch({dir,getArchives,deliver});
			writeFileSync(join(dir,'tareas','ready.json'),JSON.stringify(task));
			await m.runMasterWatch({dir,getArchives,deliver});
			console.log(JSON.stringify({calls,args:JSON.parse(readFileSync(join(root,'queue.json')))}));`,
			root,
		);
		expect(result.calls).toBe(3);
		expect(result.args[4]).toContain('T435 ready');
	});

	it('deduplicates messages and archives, excludes owner work, and never forwards owner authority', () => {
		const { root } = fixture();
		const result = probe(
			`
			const b={tareas:[{id:'owner',num:1,estado:'pendiente',agente:'codex',actor:'dueno',prompt:'SECRET OWNER AUTHORITY',requisitos:[]}],archivo:[],decisiones:[],agentes:[],bandejas:[],bitacora:[
				{tarea:'owner',quien:'dueno',mensaje:{id:'msg-one',para:'codex',texto:'SECRET OWNER AUTHORITY'}},
				{tarea:'owner',quien:'codex',mensaje:{id:'loop',para:'codex',texto:'[vigilante d351] wake'}}]};
			const events=m.wakeEvents(b,{chats:[{agente:'codex',id:'closed',titulo:'Closed chat',tarea:'T1 owner'}]},'codex');
			setMaster(dir,'codex','master-one');
			const getArchives=async()=>({chats:[{agente:'codex',id:'closed',titulo:'Closed chat'}]});
			const sent=[];const deliver=(_a,_t,text)=>sent.push(text);
			await m.runMasterWatch({dir,getArchives,deliver});
			await m.runMasterWatch({dir,getArchives:async()=>({chats:[]}),deliver});
			await m.runMasterWatch({dir,getArchives,deliver});
			setMaster(dir,'codex','master-two');
			await m.runMasterWatch({dir,getArchives,deliver});
			console.log(JSON.stringify({events,sent}));`,
			root,
		);
		expect(result.events.map((e: { key: string }) => e.key)).toEqual([
			'message:msg-one',
			'archive:closed',
		]);
		expect(JSON.stringify(result.events)).not.toContain('SECRET OWNER AUTHORITY');
		expect(result.sent).toHaveLength(2);
		expect(result.sent[0]).toContain('Archive estos chats:');
		expect(result.sent[0]).toContain('--para=claude');
	});

	it('serializes overlapping runs and preserves other agent receipts after a transport failure', () => {
		const { root } = fixture();
		const result = probe(
			`
			setMaster(dir,'codex','master-one');setMaster(dir,'gemini','master-two');
			const getArchives=async()=>({chats:[{agente:'gemini',id:'old',titulo:'Old'}]});
			const sent=[];let overlap;
			try {await m.runMasterWatch({dir,getArchives:async()=>{
				overlap=await m.runMasterWatch({dir,getArchives,deliver:()=>{throw Error('overlap')}});
				return getArchives();
			},deliver:(a)=>{if(a==='gemini')throw Error('offline');sent.push(a)}})}catch{}
			await m.runMasterWatch({dir,getArchives,deliver:a=>sent.push(a)});
			console.log(JSON.stringify({overlap,sent}));`,
			root,
		);
		expect(result).toEqual({ overlap: [], sent: ['codex', 'gemini'] });
	});

	it('does not wake for a prompt already delivered while awaiting claim', () => {
		const { root } = fixture();
		const result = probe(
			`
			const task=JSON.parse(readFileSync(join(dir,'tareas','ready.json')));
			task.entregada={agente:'codex',desde:new Date().toISOString()};
			const b={tareas:[task],archivo:[],decisiones:[],agentes:[],bitacora:[],bandejas:[]};
			console.log(JSON.stringify(m.wakeEvents(b,{chats:[]},'codex')));`,
			root,
		);
		expect(result).toEqual([]);
	});

	it('observes a new message even when the Gemini relay already consumed the inbox', () => {
		const { root } = fixture();
		const result = probe(
			`
			const b={tareas:[],archivo:[],decisiones:[],agentes:[],bandejas:[{id:'gemini',leidos:['fast-relay']}],
				bitacora:[{tarea:'ready',en:'2026-10-28T12:01:00Z',mensaje:{id:'fast-relay',para:'gemini',texto:'body'}}]};
			console.log(JSON.stringify(m.wakeEvents(b,{chats:[]},'gemini','2026-10-28T12:00:00Z')));`,
			root,
		);
		expect(result.map((e: { key: string }) => e.key)).toEqual(['message:fast-relay']);
	});

	it('uses a board message for Gemini and refuses an anchor that routes to a worker', () => {
		const { root } = fixture();
		const result = probe(
			`
			const calls=[];const exec=(...args)=>calls.push(args);
			const config={relayTask:'anchor'};
			const b={tareas:[{id:'anchor'}],archivo:[]};
			m.deliverWake('gemini','master','fixed wake',config,b,dir,exec);
			b.tareas[0].sesion={agente:'gemini',id:'worker'};let refused=false;
			try{m.deliverWake('gemini','master','fixed wake',config,b,dir,exec)}catch{refused=true}
			console.log(JSON.stringify({args:calls[0][1],refused,calls:calls.length}));`,
			root,
		);
		expect(result.args).toEqual(expect.arrayContaining(['msg', 'anchor', '--para=gemini']));
		expect(result).toMatchObject({ refused: true, calls: 1 });
	});
});
