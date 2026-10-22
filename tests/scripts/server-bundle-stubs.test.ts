import {
	SERVER_BUNDLE_STUBS,
	findServerBundleStub,
	renderServerBundleStub,
} from '../../scripts/shared/server-bundle-stubs.ts';
import { sanitizeIndicationHtml } from '@/lib/invitation/indication-html';

describe('server bundle stubs', () => {
	it('replaces zip.js only for the memories export module', () => {
		expect(
			findServerBundleStub('@zip.js/zip.js', '/repo/src/lib/memories/client/export.ts'),
		).toBe(0);
		expect(findServerBundleStub('@zip.js/zip.js', '/repo/src/lib/memories/other.ts')).toBe(-1);
	});

	it('replaces postcss only for sanitize-html', () => {
		expect(
			findServerBundleStub('postcss', 'C:\\repo\\node_modules\\sanitize-html\\index.js'),
		).toBe(1);
		expect(findServerBundleStub('postcss', '/repo/node_modules/vite/dist/node/index.js')).toBe(
			-1,
		);
		expect(findServerBundleStub('postcss', undefined)).toBe(-1);
	});

	it('renders stubs whose exports throw when called', () => {
		for (const stub of SERVER_BUNDLE_STUBS) {
			const source = renderServerBundleStub(stub);
			for (const name of stub.exports)
				expect(source).toContain(`export const ${name} = unavailable;`);
			expect(source).toContain(`${stub.source} is stubbed in the server build`);
		}
	});

	it('keeps indication HTML from parsing styles, so postcss is never called', () => {
		expect(
			sanitizeIndicationHtml(
				'<a href="https://x.mx" style="color:red">Mapa</a> <span style="a:b">x</span>',
			),
		).toBe('<a href="https://x.mx" target="_blank" rel="noopener noreferrer">Mapa</a> x');
	});
});
