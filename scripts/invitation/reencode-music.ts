#!/usr/bin/env tsx
/**
 * Re-encodes every invitation song at 96 kbps MP3 and reports the size before and after.
 * Dry-run by default: tracks are downloaded and encoded in a temporary folder that is deleted.
 * With `--write` the new files stay in `.tmp/music-96k/<slug>/` and nothing else changes: no
 * upload, no definition edit. Each file is named by its own sha256, so publishing it means a new
 * URL in the definition (authorized per invitation).
 *
 * Usage:
 *   pnpm invitation:music:reencode
 *   pnpm invitation:music:reencode --slug america --write
 *
 * Loop seam check: a native `loop` restarts the decoded audio, so any silence the encoder adds at
 * either end becomes an audible gap. The report measures the silent edges of the original and of
 * the new track, both with the LAME gapless tag applied (Chrome, Firefox) and ignored (players
 * that skip it). A track whose new edges are longer than the original's is marked `KEEP` and
 * should keep its current file.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { flagValue } from '../lib/cli-args.ts';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import { buildSemanticAssetMap } from '../provision/normalized-invitation-release.ts';

const TARGET_KBPS = 96;
const TARGET_BITRATE = `${TARGET_KBPS}k`;
const SAMPLE_RATE = 44_100;
/** Below -60 dBFS counts as silence at the edges of a track. */
const SILENCE_THRESHOLD = 0.001;
/** Extra edge silence a loop tolerates before the restart sounds like a hiccup. */
const SEAM_TOLERANCE_MS = 10;
const OUTPUT_ROOT = resolve('.tmp', 'music-96k');

interface MusicTrack {
	slug: string;
	url: string;
	loopsNatively: boolean;
}

interface EdgeSilence {
	durationSeconds: number;
	leadMs: number;
	trailMs: number;
}

interface TrackReport {
	slug: string;
	beforeBytes: number;
	afterBytes: number;
	beforeKbps: number;
	before: EdgeSilence;
	after: EdgeSilence;
	beforeRaw: EdgeSilence;
	afterRaw: EdgeSilence;
	loopsNatively: boolean;
	verdict: 'USE' | 'KEEP';
	keepReasons: string[];
	file?: string;
	proposedUrl: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Finds the first `music` object with a URL anywhere in a definition. */
const findMusic = (value: unknown): Record<string, unknown> | undefined => {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findMusic(item);
			if (found) return found;
		}
		return undefined;
	}
	if (!isRecord(value)) return undefined;
	const music = value.music;
	if (isRecord(music) && typeof music.url === 'string' && music.url.trim()) return music;
	for (const child of Object.values(value)) {
		const found = findMusic(child);
		if (found) return found;
	}
	return undefined;
};

const listMusicTracks = (slugFilter?: string): MusicTrack[] =>
	listInvitationDefinitions()
		.filter((definition) => !slugFilter || definition.slug === slugFilter)
		.flatMap((definition) => {
			const music = findMusic(
				definition.buildPublishedContent(buildSemanticAssetMap(definition)),
			);
			if (!music) return [];
			const startAt = typeof music.startAt === 'number' ? music.startAt : 0;
			return [
				{ slug: definition.slug, url: String(music.url), loopsNatively: !(startAt > 0) },
			];
		});

const run = (command: string, args: string[]): Promise<Buffer> =>
	new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(out))
				: reject(
						new Error(
							`${command} exited ${code}: ${Buffer.concat(err).toString().slice(-400)}`,
						),
					),
		);
	});

const probeKbps = async (file: string) => {
	const output = await run('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=bit_rate',
		'-of',
		'default=nw=1:nk=1',
		file,
	]);
	return Math.round(Number(output.toString().trim()) / 1000);
};

/**
 * Decodes to mono float PCM and measures the silent head and tail. `raw` ignores the gapless tag
 * (encoder delay and padding stay in), which is what a player without gapless support hears.
 */
const measureEdges = async (file: string, raw: boolean): Promise<EdgeSilence> => {
	const pcm = await run('ffmpeg', [
		'-v',
		'error',
		...(raw ? ['-flags2', '+skip_manual'] : []),
		'-i',
		file,
		'-map',
		'0:a:0',
		'-ac',
		'1',
		'-ar',
		String(SAMPLE_RATE),
		'-f',
		'f32le',
		'-',
	]);
	const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
	let lead = 0;
	while (lead < samples.length && Math.abs(samples[lead]) < SILENCE_THRESHOLD) lead += 1;
	let trail = 0;
	while (
		trail < samples.length - lead &&
		Math.abs(samples[samples.length - 1 - trail]) < SILENCE_THRESHOLD
	) {
		trail += 1;
	}
	const toMs = (count: number) => Math.round((count / SAMPLE_RATE) * 1000);
	return {
		durationSeconds: samples.length / SAMPLE_RATE,
		leadMs: toMs(lead),
		trailMs: toMs(trail),
	};
};

const seamMs = (edges: EdgeSilence) => edges.leadMs + edges.trailMs;

const processTrack = async (
	track: MusicTrack,
	workDir: string,
	write: boolean,
): Promise<TrackReport> => {
	const response = await fetch(track.url);
	if (!response.ok) throw new Error(`${track.slug}: download failed with ${response.status}`);
	const original = Buffer.from(await response.arrayBuffer());
	const extension = track.url.split('.').pop() ?? 'mp3';
	const source = join(workDir, `${track.slug}-source.${extension}`);
	const encoded = join(workDir, `${track.slug}-96k.mp3`);
	writeFileSync(source, original);

	// Audio only (drops cover art and tags); LAME writes the gapless info tag by default.
	await run('ffmpeg', [
		'-v',
		'error',
		'-y',
		'-i',
		source,
		'-map',
		'0:a:0',
		'-map_metadata',
		'-1',
		'-c:a',
		'libmp3lame',
		'-b:a',
		TARGET_BITRATE,
		'-ar',
		String(SAMPLE_RATE),
		'-write_xing',
		'1',
		encoded,
	]);

	const [beforeKbps, before, after, beforeRaw, afterRaw] = await Promise.all([
		probeKbps(source),
		measureEdges(source, false),
		measureEdges(encoded, false),
		measureEdges(source, true),
		measureEdges(encoded, true),
	]);
	const output = readFileSync(encoded);
	const sha = createHash('sha256').update(output).digest('hex');
	const fileName = `music-${sha}.mp3`;
	const proposedUrl = `${track.url.slice(0, track.url.lastIndexOf('/') + 1)}${fileName}`;

	const seamGrows =
		seamMs(after) - seamMs(before) > SEAM_TOLERANCE_MS ||
		seamMs(afterRaw) - seamMs(beforeRaw) > SEAM_TOLERANCE_MS;
	const durationDrifts = Math.abs(after.durationSeconds - before.durationSeconds) > 0.05;
	// A source already at or below the target only grows when re-encoded, and loses quality.
	const keepReasons = [
		...(beforeKbps <= TARGET_KBPS ? [`already ${beforeKbps} kbps`] : []),
		...(output.byteLength >= original.byteLength ? ['no size gain'] : []),
		...(durationDrifts ? ['duration changed'] : []),
		...(track.loopsNatively && seamGrows ? ['longer loop gap'] : []),
	];
	const verdict = keepReasons.length === 0 ? 'USE' : 'KEEP';

	let file: string | undefined;
	if (write && verdict === 'USE') {
		const dir = join(OUTPUT_ROOT, track.slug);
		mkdirSync(dir, { recursive: true });
		file = join(dir, fileName);
		writeFileSync(file, output);
	}

	return {
		slug: track.slug,
		beforeBytes: original.byteLength,
		afterBytes: output.byteLength,
		beforeKbps,
		before,
		after,
		beforeRaw,
		afterRaw,
		loopsNatively: track.loopsNatively,
		verdict,
		keepReasons,
		file,
		proposedUrl,
	};
};

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

const main = async () => {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const json = args.includes('--json');
	const tracks = listMusicTracks(flagValue(args, '--slug'));
	if (tracks.length === 0) throw new Error('No invitation definition with music.url matched.');

	const workDir = mkdtempSync(join(tmpdir(), 'celebra-music-'));
	const reports: TrackReport[] = [];
	try {
		for (const track of tracks) {
			reports.push(await processTrack(track, workDir, write));
		}
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}

	if (json) {
		console.log(JSON.stringify(reports, null, 2));
	} else {
		console.log(
			`Music re-encode at ${TARGET_BITRATE} — ${write ? `files in ${OUTPUT_ROOT}` : 'dry-run, nothing kept'}`,
		);
		for (const report of reports) {
			const change = Math.round((report.afterBytes / report.beforeBytes - 1) * 100);
			console.log(
				[
					report.verdict,
					report.slug.padEnd(28),
					`${kb(report.beforeBytes)} (${report.beforeKbps} kbps) → ${kb(report.afterBytes)}`,
					`${change > 0 ? '+' : ''}${change}%`,
					`${report.before.durationSeconds.toFixed(2)}s → ${report.after.durationSeconds.toFixed(2)}s`,
					report.loopsNatively
						? `loop edges ${seamMs(report.before)}→${seamMs(report.after)} ms (no gapless tag ${seamMs(report.beforeRaw)}→${seamMs(report.afterRaw)} ms)`
						: 'offset loop (fades in)',
				].join('  '),
			);
		}
		const before = reports.reduce((sum, report) => sum + report.beforeBytes, 0);
		const after = reports.reduce(
			(sum, report) =>
				sum + (report.verdict === 'USE' ? report.afterBytes : report.beforeBytes),
			0,
		);
		console.log(`Total ${kb(before)} → ${kb(after)}`);
	}
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
