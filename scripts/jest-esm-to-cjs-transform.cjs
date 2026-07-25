/**
 * Jest transformer: convert ESM-only node_modules (e.g. htmlparser2@12) to CJS
 * using the repo's existing esbuild dependency. Prefer this over pnpm overrides
 * that would downgrade production transitive parsers.
 */
const path = require('node:path');
const esbuild = require('esbuild');

/** @type {import('@jest/transform').Transformer} */
module.exports = {
	process(sourceText, sourcePath) {
		const result = esbuild.transformSync(sourceText, {
			loader: 'js',
			format: 'cjs',
			platform: 'node',
			target: 'node22',
			sourcefile: sourcePath,
			sourcemap: 'inline',
		});
		return { code: result.code, map: result.map };
	},
	getCacheKey(sourceText, sourcePath, options) {
		return [
			sourceText,
			sourcePath,
			options.configString,
			process.version,
			require('esbuild/package.json').version,
			path.basename(__filename),
		].join('::');
	},
};
