const fs = require('node:fs');
const path = require('node:path');

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|svg|avif)$/i;
const IMPORT_PATTERN = /from\s+['"]\.\/([^'"]+\.(?:png|jpe?g|webp|svg|avif))['"]/g;

function collectEventAssetFindings(eventsRoot) {
	const findings = [];
	if (!fs.existsSync(eventsRoot)) {
		findings.push({
			type: 'missing-root',
			path: eventsRoot,
			message: `Event assets root does not exist: ${eventsRoot}`,
		});
		return findings;
	}

	const eventDirs = fs
		.readdirSync(eventsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	for (const slug of eventDirs) {
		const eventDir = path.join(eventsRoot, slug);
		const indexPath = path.join(eventDir, 'index.ts');
		if (!fs.existsSync(indexPath)) {
			findings.push({
				type: 'missing-index',
				path: indexPath,
				message: `Missing asset module for event "${slug}".`,
			});
			continue;
		}

		const source = fs.readFileSync(indexPath, 'utf8');
		const importedFiles = new Set();
		for (const match of source.matchAll(IMPORT_PATTERN)) {
			importedFiles.add(match[1]);
		}

		if (!source.includes('export const assets')) {
			findings.push({
				type: 'missing-assets-export',
				path: indexPath,
				message: `Asset module for "${slug}" does not export "assets".`,
			});
		}

		const actualFiles = fs
			.readdirSync(eventDir, { withFileTypes: true })
			.filter((entry) => entry.isFile() && IMAGE_FILE_PATTERN.test(entry.name))
			.map((entry) => entry.name)
			.sort();

		for (const file of actualFiles) {
			if (!importedFiles.has(file)) {
				findings.push({
					type: 'untracked-file',
					path: path.join(eventDir, file),
					message: `Image file "${file}" in "${slug}" is not imported by index.ts.`,
				});
			}
		}

		for (const importedFile of importedFiles) {
			const importedPath = path.join(eventDir, importedFile);
			if (!fs.existsSync(importedPath)) {
				findings.push({
					type: 'missing-import-target',
					path: importedPath,
					message: `Asset module for "${slug}" imports missing file "${importedFile}".`,
				});
			}
		}
	}

	return findings;
}

function formatFindings(findings) {
	if (!findings.length) {
		return ['PASS event asset registry audit'];
	}

	return findings.map((finding) => `FAIL ${finding.type} ${finding.message}`);
}

function main() {
	const eventsRoot = path.resolve(process.cwd(), 'src/assets/images/events');
	const findings = collectEventAssetFindings(eventsRoot);
	for (const line of formatFindings(findings)) {
		console.log(line);
	}
	if (findings.length) {
		process.exitCode = 1;
	}
}

if (require.main === module) {
	main();
}

module.exports = {
	collectEventAssetFindings,
	formatFindings,
};
