import { readFileSync, writeFileSync } from 'node:fs';

const GENERATED_PROCESS_ENV_BLOCK =
	/\r?\ntype StringifyValues<[\s\S]+?declare namespace NodeJS \{\r?\n\tinterface ProcessEnv[\s\S]+?\r?\n\}\r?\n?$/;

for (const filePath of process.argv.slice(2)) {
	const source = readFileSync(filePath, 'utf8');
	if (!GENERATED_PROCESS_ENV_BLOCK.test(source)) {
		throw new Error(`Wrangler ProcessEnv block not found in ${filePath}.`);
	}
	writeFileSync(
		filePath,
		source.replace(
			GENERATED_PROCESS_ENV_BLOCK,
			'\n// NodeJS.ProcessEnv projection removed: this monorepo validates partial script environments.\n',
		),
		'utf8',
	);
}
