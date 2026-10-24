/**
 * The board's monthly .zip files (d186, d187): <dir>/mensual/<YYYY-MM>.zip. A plain ZIP (deflate, UTF-8 names)
 * that any unzip tool opens; no dependency, Node's zlib does the compression and the CRC.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const UTF8 = 0x0800;

/** Every entry of a zip file as `{ name, data }`; a missing file is an empty list. */
export function readZip(file) {
	if (!existsSync(file)) return [];
	const buf = readFileSync(file);
	let end = buf.length - 22;
	while (end >= 0 && buf.readUInt32LE(end) !== END) end--;
	if (end < 0) throw new Error(`${file} no es un zip`);
	const count = buf.readUInt16LE(end + 10);
	let at = buf.readUInt32LE(end + 16);
	const entries = [];
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(at) !== CENTRAL) throw new Error(`${file}: directorio dañado`);
		const method = buf.readUInt16LE(at + 10);
		const size = buf.readUInt32LE(at + 20);
		const nameLen = buf.readUInt16LE(at + 28);
		const skip = buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
		const offset = buf.readUInt32LE(at + 42);
		const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
		const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
		const raw = buf.subarray(start, start + size);
		entries.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
		at += 46 + nameLen + skip;
	}
	return entries;
}

/** Write a zip with these entries, through a temp file and rename. */
export function writeZip(file, entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const { name, data } of entries) {
		const body = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
		const packed = deflateRawSync(body);
		const nameBuf = Buffer.from(name, 'utf8');
		const crc = crc32(body);
		const head = Buffer.alloc(30);
		head.writeUInt32LE(LOCAL, 0);
		head.writeUInt16LE(20, 4);
		head.writeUInt16LE(UTF8, 6);
		head.writeUInt16LE(8, 8);
		// DOS time 00:00, date 1980-01-01: the board's own fields carry the real dates.
		head.writeUInt16LE(0x21, 12);
		head.writeUInt32LE(crc, 14);
		head.writeUInt32LE(packed.length, 18);
		head.writeUInt32LE(body.length, 22);
		head.writeUInt16LE(nameBuf.length, 26);
		const dir = Buffer.alloc(46);
		dir.writeUInt32LE(CENTRAL, 0);
		dir.writeUInt16LE(20, 4);
		dir.writeUInt16LE(20, 6);
		dir.writeUInt16LE(UTF8, 8);
		dir.writeUInt16LE(8, 10);
		dir.writeUInt16LE(0x21, 14);
		dir.writeUInt32LE(crc, 16);
		dir.writeUInt32LE(packed.length, 20);
		dir.writeUInt32LE(body.length, 24);
		dir.writeUInt16LE(nameBuf.length, 28);
		dir.writeUInt32LE(offset, 42);
		locals.push(head, nameBuf, packed);
		centrals.push(dir, nameBuf);
		offset += head.length + nameBuf.length + packed.length;
	}
	const central = Buffer.concat(centrals);
	const tail = Buffer.alloc(22);
	tail.writeUInt32LE(END, 0);
	tail.writeUInt16LE(entries.length, 8);
	tail.writeUInt16LE(entries.length, 10);
	tail.writeUInt32LE(central.length, 12);
	tail.writeUInt32LE(offset, 16);
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, Buffer.concat([...locals, central, tail]));
	renameSync(tmp, file);
}

/** Add or replace entries by name, keeping every other entry of the file. */
export function addToZip(file, added) {
	const names = new Set(added.map((e) => e.name));
	writeZip(file, [...readZip(file).filter((e) => !names.has(e.name)), ...added]);
}
