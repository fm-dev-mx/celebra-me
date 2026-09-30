import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import {
	buildMemoriesR2CorsConfig,
	buildMemoriesR2LifecycleConfig,
} from '../../workers/celebra-memories-sign/r2-config.ts';

const outputDirectory = path.join(process.cwd(), 'workers', 'celebra-memories-sign');

async function writeJson(fileName: string, value: unknown): Promise<void> {
	const outputPath = path.join(outputDirectory, fileName);
	const prettierConfig = (await resolveConfig(outputPath)) ?? {};
	// Expanded input keeps Prettier from collapsing objects, so regeneration is byte-stable.
	writeFileSync(
		outputPath,
		await format(JSON.stringify(value, null, 4), { ...prettierConfig, filepath: outputPath }),
		'utf8',
	);
	process.stdout.write(`Generated ${path.relative(process.cwd(), outputPath)}\n`);
}

async function main(): Promise<void> {
	for (const target of ['staging', 'production'] as const) {
		await writeJson(`r2-cors.${target}.json`, buildMemoriesR2CorsConfig());
	}
	await writeJson('r2-lifecycle.production.json', buildMemoriesR2LifecycleConfig());
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
