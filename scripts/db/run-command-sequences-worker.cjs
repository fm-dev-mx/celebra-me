'use strict';

const { spawn } = require('node:child_process');
const { writeFileSync, writeSync } = require('node:fs');
const tty = require('node:tty');
const { workerData } = require('node:worker_threads');

const { sequences, resultPath, sab } = workerData;
const lock = new Int32Array(sab);

// One writer per fd. A terminal gets a tty.WriteStream (blocking on Windows, and it encodes
// for the console, where raw UTF-8 bytes from writeSync print ✓ as mojibake).
const terminalStreams = new Map();
function writeToFd(fd, text) {
	if (!terminalStreams.has(fd)) {
		terminalStreams.set(fd, tty.isatty(fd) ? new tty.WriteStream(fd) : null);
	}
	const stream = terminalStreams.get(fd);
	if (stream) stream.write(text);
	else writeSync(fd, text);
}

// Echo whole lines from this thread: the main thread is blocked in Atomics.wait, so
// process.stdout would not flush until every job ends. Whole lines keep parallel jobs readable.
function createLineEcho(fd) {
	let pending = '';
	const write = (text) => {
		try {
			writeToFd(fd, text);
		} catch {
			// A closed or busy parent stream must not fail the job; output is still captured.
		}
	};
	return {
		push(chunk) {
			pending += chunk;
			const end = pending.lastIndexOf('\n');
			if (end === -1) return;
			write(pending.slice(0, end + 1));
			pending = pending.slice(end + 1);
		},
		flush() {
			if (pending) write(pending);
			pending = '';
		},
	};
}

function runPreparedJob(job) {
	return new Promise((resolve, reject) => {
		const child = spawn(job.file, job.args, {
			cwd: job.cwd,
			env: job.env,
			shell: job.shell,
			stdio: job.stdio,
		});
		let stdout = '';
		let stderr = '';
		const stdoutEcho = job.echoOutput ? createLineEcho(1) : null;
		const stderrEcho = job.echoOutput ? createLineEcho(2) : null;
		if (child.stdout) {
			child.stdout.setEncoding('utf8');
			child.stdout.on('data', (chunk) => {
				stdout += chunk;
				stdoutEcho?.push(chunk);
			});
		}
		if (child.stderr) {
			child.stderr.setEncoding('utf8');
			child.stderr.on('data', (chunk) => {
				stderr += chunk;
				stderrEcho?.push(chunk);
			});
		}
		if (job.input != null && child.stdin) {
			child.stdin.end(job.input);
		}
		const timer =
			typeof job.timeoutMs === 'number' && job.timeoutMs > 0
				? setTimeout(() => {
						child.kill('SIGKILL');
					}, job.timeoutMs)
				: undefined;
		child.on('error', (error) => {
			if (timer) clearTimeout(timer);
			reject(error);
		});
		child.on('close', (status) => {
			if (timer) clearTimeout(timer);
			stdoutEcho?.flush();
			stderrEcho?.flush();
			resolve({ status, stdout, stderr });
		});
	});
}

async function runSequence(jobs) {
	const results = [];
	for (const job of jobs) {
		const result = await runPreparedJob(job);
		results.push(result);
		if (result.status !== 0) break;
	}
	return results;
}

Promise.all(sequences.map((jobs) => runSequence(jobs)))
	.then((results) => {
		writeFileSync(resultPath, `${JSON.stringify(results)}\n`);
	})
	.catch((error) => {
		writeFileSync(resultPath, `${JSON.stringify({ error: String(error) })}\n`);
	})
	.then(() => {
		// Let echoed terminal lines reach the console before the main thread resumes.
		const streams = [...terminalStreams.values()].filter(Boolean);
		return Promise.all(streams.map((stream) => new Promise((done) => stream.write('', done))));
	})
	.finally(() => {
		Atomics.store(lock, 0, 1);
		Atomics.notify(lock, 0);
	});
