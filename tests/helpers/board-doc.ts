import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Json = Record<string, unknown>;

/** T529: a review round `<id>-revision(-N)` lives in its task's `rondas`, not in a file of its own. */
const ROUND_ID = /^(.+)-revision(?:-([1-9]\d*))?$/;

const fileOf = (dir: string, id: string, collection = 'tareas') =>
	path.join(dir, collection, `${id}.json`);

const readJson = (file: string): Json => JSON.parse(readFileSync(file, 'utf8'));

/** The parent file of round `id` and the round's index in its `rondas`, or null. */
function roundSlot(dir: string, id: string, collection: string) {
	const match = ROUND_ID.exec(id);
	if (!match || !existsSync(fileOf(dir, match[1], collection))) return null;
	const file = fileOf(dir, match[1], collection);
	const parent = readJson(file);
	const rondas = (parent.rondas ?? []) as Json[];
	const index = rondas.findIndex((r) => r.id === id);
	return index < 0 ? null : { file, parent, rondas, index };
}

/** A task as stored on disk, or the round `id` from its parent's `rondas` (with `origen` and `ronda`). */
export function readBoardDoc(dir: string, id: string, collection = 'tareas'): Json {
	if (existsSync(fileOf(dir, id, collection))) return readJson(fileOf(dir, id, collection));
	const slot = roundSlot(dir, id, collection);
	if (!slot) throw new Error(`ENOENT: ${collection}/${id}.json and no round ${id}`);
	const parent = ROUND_ID.exec(id)?.[1];
	return { ...slot.rondas[slot.index], origen: parent, ronda: true };
}

/** Merges `fields` into task `id`, or into round `id` inside its parent. */
export function patchBoardDoc(dir: string, id: string, fields: Json, collection = 'tareas') {
	if (existsSync(fileOf(dir, id, collection))) {
		const file = fileOf(dir, id, collection);
		return writeFileSync(file, JSON.stringify({ ...readJson(file), ...fields }));
	}
	const slot = roundSlot(dir, id, collection);
	if (!slot) throw new Error(`ENOENT: ${collection}/${id}.json and no round ${id}`);
	slot.rondas[slot.index] = { ...slot.rondas[slot.index], ...fields };
	writeFileSync(slot.file, JSON.stringify({ ...slot.parent, rondas: slot.rondas }));
}

/** Whether round or task `id` exists, in a file of its own or inside its parent. */
export function hasBoardDoc(dir: string, id: string, collection = 'tareas') {
	return existsSync(fileOf(dir, id, collection)) || Boolean(roundSlot(dir, id, collection));
}
