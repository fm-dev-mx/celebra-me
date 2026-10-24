import {
	checkRouteExpectations,
	compareImageRegions,
	comparePixels,
	densestBand,
	renderRemoteReport,
	sameStatusClass,
	selectCases,
	type RemoteFailure,
} from '../../scripts/screenshot/remote/remote-compare';
import {
	imageIdentity,
	normalizeLocation,
	routeFileStem,
	type RemoteImageRegion,
	type RemoteRouteRecord,
} from '../../scripts/screenshot/remote/remote-manifest';
import {
	decideRemoteRequest,
	resolveRemoteTarget,
} from '../../scripts/screenshot/remote/remote-target';
import {
	buildRouteCandidates,
	type RouteSources,
} from '../../scripts/screenshot/remote/route-inventory';

const ACCESS_ENV = {
	CLOUDFLARE_ACCESS_CLIENT_ID: 'client-id-value',
	CLOUDFLARE_ACCESS_CLIENT_SECRET: 'client-secret-value',
};
const PRODUCTION_VERSION = 'https://1a2b3c4d-celebra-me.celebra-me-com.workers.dev';

describe('remote visual target allow-list', () => {
	it('accepts the public Production domain without Access headers', () => {
		const target = resolveRemoteTarget('https://www.celebra-me.com', {});
		expect(target).toEqual({
			origin: 'https://www.celebra-me.com',
			host: 'www.celebra-me.com',
			kind: 'production-domain',
		});
	});

	it('accepts Cloudflare Worker hosts only with the Access service token', () => {
		expect(() => resolveRemoteTarget(PRODUCTION_VERSION, {})).toThrow(
			'CLOUDFLARE_ACCESS_CLIENT_ID',
		);
		const target = resolveRemoteTarget(PRODUCTION_VERSION, ACCESS_ENV);
		expect(target.kind).toBe('production-version');
		expect(target.accessHeaders).toEqual({
			'CF-Access-Client-Id': 'client-id-value',
			'CF-Access-Client-Secret': 'client-secret-value',
		});
		expect(
			resolveRemoteTarget('https://celebra-me-preview.celebra-me-com.workers.dev', ACCESS_ENV)
				.kind,
		).toBe('preview-worker');
	});

	it.each([
		'http://www.celebra-me.com',
		'https://celebra-me.com',
		'https://www.celebra-me.com/xv/america',
		'https://www.celebra-me.com?x=1',
		'https://www.celebra-me.com:8443',
		'https://example.com',
		'https://evil-celebra-me.celebra-me-com.workers.dev.example.com',
	])('rejects %s', (origin) => {
		expect(() => resolveRemoteTarget(origin, ACCESS_ENV)).toThrow();
	});

	it('never echoes Access secrets in errors', () => {
		try {
			resolveRemoteTarget('https://example.com', ACCESS_ENV);
		} catch (error) {
			expect(String(error)).not.toContain('client-secret-value');
		}
	});

	it('blocks writes, tracking beacons and measurement hosts', () => {
		const target = { origin: 'https://www.celebra-me.com' };
		expect(decideRemoteRequest(target, 'POST', 'https://www.celebra-me.com/api/x')).toBe(
			'abort',
		);
		expect(
			decideRemoteRequest(target, 'GET', 'https://www.celebra-me.com/api/tracking/events'),
		).toBe('abort');
		expect(
			decideRemoteRequest(target, 'GET', 'https://www.googletagmanager.com/gtag/js?id=G-1'),
		).toBe('abort');
		expect(decideRemoteRequest(target, 'GET', 'https://www.celebra-me.com/_astro/a.css')).toBe(
			'continue',
		);
	});

	it('adds Access headers only to the target origin', () => {
		const target = resolveRemoteTarget(PRODUCTION_VERSION, ACCESS_ENV);
		expect(decideRemoteRequest(target, 'GET', `${PRODUCTION_VERSION}/xv/america`)).toBe(
			'continue-with-access',
		);
		expect(decideRemoteRequest(target, 'GET', 'https://fonts.googleapis.com/css2')).toBe(
			'continue',
		);
	});
});

describe('remote route inventory', () => {
	const sources: RouteSources = {
		definitions: [
			{ eventType: 'xv', slug: 'naydelin-paredes', lifecycle: 'in_progress' },
			{ eventType: 'boda', slug: 'daniela-y-martin', lifecycle: 'published' },
		],
		demos: [{ eventType: 'xv', slug: 'demo-xv-editorial' }],
		redirects: [
			{
				source: '/:eventType/:slug/antiguo',
				destination: '/:eventType/:slug',
				permanent: true,
			},
			{ source: '/a', destination: '/b', permanent: true },
			{ source: '/temporary', destination: '/b', permanent: false },
		],
		memoriesPaths: ['/r/victoria-y-roberto'],
	};

	it('lists site pages, demos, definitions, memories and redirects', () => {
		const routes = buildRouteCandidates(sources);
		expect(routes.map((route) => route.path)).toEqual([
			'/',
			'/login',
			'/privacidad',
			'/terminos',
			'/editorial',
			'/boda/daniela-y-martin',
			'/xv/naydelin-paredes',
			'/r/victoria-y-roberto',
			'/boda/daniela-y-martin/antiguo',
			'/a',
		]);
		expect(routes.find((route) => route.path === '/xv/naydelin-paredes')?.lifecycle).toBe(
			'in_progress',
		);
		expect(
			routes.find((route) => route.path === '/boda/daniela-y-martin/antiguo'),
		).toMatchObject({ kind: 'redirect', expectedLocation: '/boda/daniela-y-martin' });
	});
});

describe('remote manifest helpers', () => {
	it.each([
		['/_image?href=%2F_astro%2Fhero.Bx3kL9aZ.jpg&w=1080', 'hero.jpg'],
		['https://cdn.example/cdn-cgi/image/width=800/photos/Portada.JPG', 'portada.jpg'],
		['https://www.celebra-me.com/_astro/hero.Bx3kL9aZ.webp', 'hero.webp'],
	])('derives a host-independent identity for %s', (source, identity) => {
		expect(imageIdentity(source)).toBe(identity);
	});

	it('normalizes locations and file names', () => {
		expect(
			normalizeLocation('https://www.celebra-me.com/xv/a/', 'https://www.celebra-me.com'),
		).toBe('/xv/a');
		expect(normalizeLocation('/', 'https://www.celebra-me.com')).toBe('/');
		expect(normalizeLocation('https://other.example/x', 'https://www.celebra-me.com')).toBe(
			'https://other.example/x',
		);
		expect(routeFileStem('/')).toBe('home');
		expect(routeFileStem('/xv/demo-xv-editorial')).toBe('xv_demo-xv-editorial');
	});
});

function region(
	identity: string,
	y: number,
	extra: Partial<RemoteImageRegion> = {},
): RemoteImageRegion {
	return {
		kind: 'img',
		identity,
		box: { x: 0, y, width: 100, height: 100 },
		loaded: true,
		...extra,
	};
}

describe('remote compare rules', () => {
	const route = { path: '/xv/america', group: 'invitation' as const };

	it('treats 301/308 and 302/307 as the same redirect class', () => {
		expect(sameStatusClass(308, 301)).toBe(true);
		expect(sameStatusClass(302, 307)).toBe(true);
		expect(sameStatusClass(200, 404)).toBe(false);
		expect(sameStatusClass(301, 302)).toBe(false);
	});

	it('requires permanent redirects to the expected path and 200 webp photos', () => {
		const redirect = {
			path: '/a/antiguo',
			kind: 'redirect',
			group: 'redirect',
			expectedLocation: '/a',
			status: 302,
			location: '/b',
			live: true,
			captures: {},
		} as RemoteRouteRecord;
		expect(checkRouteExpectations(redirect).map((failure) => failure.kind)).toEqual([
			'redirect-changed',
			'redirect-changed',
		]);
		const photo = {
			path: '/media/x.webp',
			kind: 'asset',
			group: 'preview-photo',
			expectedContentType: 'image/webp',
			status: 200,
			contentType: 'image/jpeg',
			live: true,
			captures: {},
		} as RemoteRouteRecord;
		expect(checkRouteExpectations(photo)[0]?.kind).toBe('asset-invalid');
		expect(checkRouteExpectations({ ...photo, contentType: 'image/webp' })).toEqual([]);
	});

	it('flags missing, replaced, moved and broken photos once per kind', () => {
		const before = [region('a.jpg', 0), region('b.jpg', 200), region('c.jpg', 400)];
		expect(compareImageRegions(route, 'desktop', before, before)).toEqual([]);
		const kinds = (after: RemoteImageRegion[]) =>
			compareImageRegions(route, 'desktop', before, after).map((failure) => failure.kind);
		expect(kinds(before.slice(0, 2))).toEqual(['image-missing']);
		expect(kinds([before[0], region('x.jpg', 200), before[2]])).toEqual(['image-missing']);
		expect(kinds([before[0], region('b.jpg', 260), region('c.jpg', 460)])).toEqual([
			'image-moved',
		]);
		expect(
			compareImageRegions(route, 'desktop', before, [
				before[0],
				region('b.jpg', 260),
				region('c.jpg', 460),
			])[0].detail,
		).toContain('y 1 más');
		expect(kinds([before[0], region('b.jpg', 200, { loaded: false }), before[2]])).toEqual([
			'image-broken',
		]);
		expect(kinds([...before, region('d.jpg', 600)])).toEqual([]);
	});

	function solid(width: number, height: number, value: number) {
		return { data: Buffer.alloc(width * height * 4, value), width, height };
	}

	it('measures changed pixels outside photo regions only', () => {
		const before = solid(10, 10, 255);
		expect(comparePixels(before, solid(10, 10, 255), []).ratio).toBe(0);
		const after = solid(10, 10, 255);
		after.data.fill(0, 0, 10 * 4 * 2); // first two rows turn black
		for (let index = 3; index < after.data.length; index += 4) after.data[index] = 255;
		expect(comparePixels(before, after, []).ratio).toBeCloseTo(0.2);
		const masked = comparePixels(before, after, [
			region('a.jpg', 0, { box: { x: 0, y: 0, width: 10, height: 2 } }),
		]);
		expect(masked.ratio).toBe(0);
		expect(masked.maskedPixels).toBe(20);
		const taller = comparePixels(before, solid(10, 12, 255), []);
		expect(taller.sizeChanged).toBe(true);
		expect(taller.changedPixels).toBe(20);
	});

	it('finds the densest band of changed rows', () => {
		const rows = new Uint32Array(100);
		rows.fill(5, 60, 70);
		expect(densestBand(rows, 20)).toBe(55);
	});

	it('selects at most six cases, spread across groups', () => {
		const failures: RemoteFailure[] = Array.from({ length: 12 }, (_, index) => ({
			kind: 'pixels-changed',
			path: `/p${index}`,
			group: index % 2 ? 'demo' : 'invitation',
			viewport: 'desktop',
			detail: '',
			ratio: index / 100,
			focus: { x: 0, y: 0, width: 10, height: 10 },
		}));
		failures.push({ kind: 'status-changed', path: '/x', group: 'site', detail: '' });
		const cases = selectCases(failures);
		expect(cases).toHaveLength(6);
		expect(
			cases
				.slice(0, 2)
				.map((failure) => failure.group)
				.sort(),
		).toEqual(['demo', 'invitation']);
		expect(cases[0].ratio).toBe(0.11);
	});

	it('renders a grouped Spanish report', () => {
		const report = renderRemoteReport({
			passed: false,
			before: { label: 'antes', origin: 'https://www.celebra-me.com', capturedAt: 't0' },
			after: { label: 'despues', origin: 'https://www.celebra-me.com', capturedAt: 't1' },
			routeCount: 2,
			failures: [
				{
					kind: 'status-changed',
					path: '/x',
					group: 'site',
					detail: 'respondía 200 y ahora 404',
				},
			],
			warnings: [],
			comparisons: [],
			cases: [],
		});
		expect(report).toContain('FALLIDA');
		expect(report).toContain('### Código HTTP distinto (1)');
	});
});
