import type { Plugin } from 'vite';

/**
 * Modules the server build never runs, replaced by stubs so they stay out of the Worker upload.
 * Each stub throws if it is ever called, so a wrong entry fails loudly instead of misbehaving.
 */
export interface ServerBundleStub {
	/** Bare import specifier to replace. */
	source: string;
	/** Only imports from a matching file are replaced. */
	importer: RegExp;
	/** Named exports the importer reads at load time. */
	exports: readonly string[];
	reason: string;
}

export const SERVER_BUNDLE_STUBS: readonly ServerBundleStub[] = [
	{
		source: '@zip.js/zip.js',
		importer: /[\\/]src[\\/]lib[\\/]memories[\\/]client[\\/]export\.ts$/,
		exports: ['BlobReader', 'BlobWriter', 'ZipWriter'],
		reason: 'The memories ZIP export runs in the browser only.',
	},
	{
		source: 'postcss',
		importer: /[\\/]sanitize-html[\\/]index\.js$/,
		exports: ['parse'],
		reason: 'sanitize-html needs postcss only to parse style attributes, and indication HTML allows none (parseStyleAttributes: false).',
	},
];

const STUB_PREFIX = '\0celebra-server-stub:';

export function findServerBundleStub(
	source: string,
	importer: string | undefined,
	stubs: readonly ServerBundleStub[] = SERVER_BUNDLE_STUBS,
): number {
	if (!importer) return -1;
	return stubs.findIndex((stub) => stub.source === source && stub.importer.test(importer));
}

export function renderServerBundleStub(stub: ServerBundleStub): string {
	const lines = [
		`const unavailable = () => { throw new Error(${JSON.stringify(`${stub.source} is stubbed in the server build: ${stub.reason}`)}); };`,
		...stub.exports.map((name) => `export const ${name} = unavailable;`),
		'export default { ' + stub.exports.map((name) => `${name}: unavailable`).join(', ') + ' };',
	];
	return `${lines.join('\n')}\n`;
}

/** Vite plugin for `astro build`: swaps the listed imports for stubs in the server environment. */
export function serverBundleStubs(
	stubs: readonly ServerBundleStub[] = SERVER_BUNDLE_STUBS,
): Plugin {
	return {
		name: 'celebra:server-bundle-stubs',
		apply: 'build',
		enforce: 'pre',
		resolveId(source, importer, options) {
			const isServer =
				this.environment?.config.consumer === 'server' || options?.ssr === true;
			if (!isServer) return null;
			const index = findServerBundleStub(source, importer, stubs);
			return index === -1 ? null : `${STUB_PREFIX}${index}`;
		},
		load(id) {
			if (!id.startsWith(STUB_PREFIX)) return null;
			const stub = stubs[Number(id.slice(STUB_PREFIX.length))];
			return stub ? renderServerBundleStub(stub) : null;
		},
	};
}
