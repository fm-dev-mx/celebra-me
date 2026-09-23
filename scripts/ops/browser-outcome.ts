import { appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

export type BrowserCheckOutcome = 'success' | 'visual_diff' | 'code';

function listFiles(root: string): string[] {
	const files: string[] = [];
	const visit = (path: string): void => {
		for (const entry of readdirSync(path, { withFileTypes: true })) {
			const child = join(path, entry.name);
			if (entry.isDirectory()) visit(child);
			else if (entry.isFile()) files.push(relative(root, child).replaceAll('\\', '/'));
		}
	};
	try {
		if (statSync(root).isDirectory()) visit(root);
	} catch {
		return [];
	}
	return files.sort();
}

export function classifyBrowserOutcome(
	stepOutcome: string,
	evidenceFiles: string[],
): BrowserCheckOutcome {
	if (stepOutcome === 'success') return 'success';
	return evidenceFiles.some((file) => /(?:^|\/).+-(?:actual|diff)\.png$/u.test(file))
		? 'visual_diff'
		: 'code';
}

function main(): void {
	const stepOutcome = process.env.BROWSER_STEP_OUTCOME ?? '';
	const files = listFiles('test-results');
	const classification = classifyBrowserOutcome(stepOutcome, files);
	const visualFiles = files.filter((file) => /-(?:actual|diff)\.png$/u.test(file));
	const evidence = {
		classification,
		stepOutcome,
		visualFiles,
	};
	mkdirSync('.tmp', { recursive: true });
	writeFileSync('.tmp/browser-outcome.json', `${JSON.stringify(evidence, null, 2)}\n`);
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `classification=${classification}\n`);
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`Browser outcome: **${classification}**\n\n${visualFiles.map((file) => `- \`${file}\``).join('\n')}\n`,
		);
	}
	console.log(JSON.stringify(evidence));
}

if (process.argv[1] && /^browser-outcome\.(?:ts|js)$/.test(basename(process.argv[1]))) main();
