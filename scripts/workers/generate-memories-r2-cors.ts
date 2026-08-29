import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { buildValentinaMemoriesR2CorsConfig } from '../../src/data/valentina-memories-upload.contract';

const outputDirectory = path.join(process.cwd(), 'workers', 'celebra-memories-sign');

for (const target of ['staging', 'production'] as const) {
	const outputPath = path.join(outputDirectory, `r2-cors.${target}.json`);
	const prettierConfig = (await resolveConfig(outputPath)) ?? {};
	const serialized = await format(JSON.stringify(buildValentinaMemoriesR2CorsConfig(target)), {
		...prettierConfig,
		filepath: outputPath,
	});
	writeFileSync(outputPath, serialized, 'utf8');
	process.stdout.write(`Generated ${path.relative(process.cwd(), outputPath)}\n`);
}
