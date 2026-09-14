#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { classifyReleaseRange } from './release-classification.ts';

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
};
const baseSha = value('--base') ?? process.env.VALIDATION_BASE_SHA;
const headSha = value('--head') ?? process.env.VALIDATION_HEAD_SHA;
if (!baseSha || !headSha) throw new Error('Both --base and --head exact SHAs are required.');
const report = classifyReleaseRange(baseSha, headSha);
const json = JSON.stringify(report, null, 2);
const output = value('--output');
if (output) writeFileSync(output, `${json}\n`, 'utf8');
if (args.includes('--json')) console.log(json);
else {
	console.log(`Release classification: ${report.category}`);
	for (const reason of report.reasons) console.log(`- ${reason}`);
}
