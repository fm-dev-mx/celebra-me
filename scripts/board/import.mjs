/**
 * One-time migration of the ArtifactData export (board v2) into the local store (board v3).
 * `espera`, `usted` and `deps` become `requisitos`; `mapa` (task id → fields) sets what only a person can judge,
 * such as urgencia, actor, agente or toca.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readCollection, writeDoc } from './store.mjs';

const DROP = ['espera', 'usted', 'deps', 'desde'];
const TOCA_V2 = {
	produccion: ['produccion'],
	migracion: ['migracion'],
	release: ['main', 'produccion'],
};

const ustedText = (u) =>
	Array.isArray(u)
		? u
				.map((s) => s?.t)
				.filter(Boolean)
				.join(' · ')
		: String(u ?? '');

export function toV3(t, extra = {}) {
	const out = { ...t };
	for (const k of DROP) delete out[k];
	const req = (t.deps ?? []).map((ref) => ({ tipo: 'tarea', ref }));
	if (t.espera === 'fecha' && (t.desde || t.hasta))
		req.push({ tipo: 'fecha', ref: t.desde || t.hasta });
	if (t.espera === 'usted')
		req.push({ tipo: 'dueno', ref: ustedText(t.usted) || 'Paso del dueño', ok: false });
	const toca = [...new Set((t.toca ?? []).flatMap((s) => TOCA_V2[s] ?? []))];
	return {
		...out,
		estado: t.estado ?? 'pendiente',
		urgencia: 'normal',
		actor: t.espera === 'usted' ? 'dueno' : 'sesion',
		agente: 'cualquiera',
		toca,
		requisitos: req,
		...extra,
	};
}

export function importExport(src, dir, mapa = {}) {
	const counts = {};
	for (const c of readdirSync(src).filter((f) => existsSync(join(src, f)) && !f.includes('.'))) {
		const docs = readCollection(src, c);
		for (const d of docs) writeDoc(dir, c, d.id, c === 'tareas' ? toV3(d, mapa[d.id]) : d);
		counts[c] = docs.length;
	}
	return counts;
}
