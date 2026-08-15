'use strict';

const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { workerData } = require('node:worker_threads');

const { sequences, resultPath, sab } = workerData;
const lock = new Int32Array(sab);

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
		if (child.stdout) {
			child.stdout.setEncoding('utf8');
			child.stdout.on('data', (chunk) => {
				stdout += chunk;
			});
		}
		if (child.stderr) {
			child.stderr.setEncoding('utf8');
			child.stderr.on('data', (chunk) => {
				stderr += chunk;
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
	.finally(() => {
		Atomics.store(lock, 0, 1);
		Atomics.notify(lock, 0);
	});
