import {
	captureControls,
	collectPresentationEvidence,
	presentationFailures,
	observeCaptureResources,
} from '../../../scripts/screenshot/presentation-evidence';

describe('capture presentation evidence', () => {
	const observed = {
		harness: 'full-invitation',
		missingLayers: ['global', 'invitation'],
		stylesheets: [],
		fonts: [],
		samples: [],
		fontSetStatus: 'loaded',
		content: 'Synthetic guest content',
		images: [
			{ source: 'data:image/png;base64,private-image', loaded: true, width: 10, height: 20 },
		],
		locale: 'es-MX',
		timezone: 'UTC',
		deviceScaleFactor: 1,
		viewportScale: 1,
		observedClock: '2026-09-19T00:00:00.000Z',
		reducedMotion: false,
	};
	const pageFor = (
		value = observed,
		url = 'http://localhost/test/variant?full=1&invite=private-token',
	) => ({
		evaluate: async () => value,
		url: () => url,
		context: () => ({ browser: () => ({ version: () => 'test-browser' }) }),
	});

	it('rejects full harness evidence with absent base CSS even if presentation was requested', async () => {
		const evidence = await collectPresentationEvidence(
			pageFor(observed, 'http://localhost/test/variant?full=1&presentation=1') as never,
		);
		expect(presentationFailures(evidence)).toEqual([
			expect.stringContaining('INCOMPLETE_PRESENTATION'),
		]);
	});

	it('accepts loaded layers but does not turn computed font families into glyph certification', async () => {
		const evidence = await collectPresentationEvidence(
			pageFor({ ...observed, missingLayers: [] }) as never,
		);
		expect(evidence.presentation).toBe('complete');
		expect(presentationFailures(evidence)).toEqual([]);
		expect(evidence.glyphFallbackVerification).toBe('unverified');
	});

	it('keeps isolated and public route presentation unverified instead of rejecting legitimate captures', async () => {
		for (const url of [
			'http://localhost/test/variant?section=hero',
			'http://localhost/boda/synthetic',
		]) {
			const evidence = await collectPresentationEvidence(
				pageFor({ ...observed, harness: 'isolated-section' }, url) as never,
			);
			expect(evidence.presentation).toBe('unverified');
			expect(presentationFailures(evidence)).toEqual([]);
		}
	});

	it('blocks failed or still-loading fonts without claiming that loaded means correct fallback', async () => {
		const evidence = await collectPresentationEvidence(
			pageFor({ ...observed, missingLayers: [] }) as never,
		);
		expect(presentationFailures({ ...evidence, fontSetStatus: 'loading' })).toEqual([
			expect.stringContaining('FONT_LOAD_INCOMPLETE'),
		]);
		expect(
			presentationFailures({
				...evidence,
				fonts: [{ family: 'Synthetic', weight: '400', style: 'normal', status: 'error' }],
			}),
		).toHaveLength(1);
	});

	it('persists hashes rather than personalized content, image data or arbitrary query values', async () => {
		const evidence = await collectPresentationEvidence(pageFor() as never);
		const serialized = JSON.stringify(evidence);
		for (const value of ['private-token', 'Synthetic guest content', 'private-image'])
			expect(serialized).not.toContain(value);
		expect(evidence.contentSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(
			captureControls(
				'/test/variant?presentation=secret&full=1&guestName=Private&animations=off',
			),
		).toEqual({ full: '1', animations: 'off' });
	});

	it('hashes render response bytes, records unreadable resources and never reads API bodies', async () => {
		let onResponse: (response: unknown) => void = () => undefined;
		const read = observeCaptureResources({
			on: (_: string, listener: typeof onResponse) => {
				onResponse = listener;
			},
		} as never);
		const apiBody = jest.fn();
		const response = (kind: string, body: () => Promise<Buffer>) => ({
			request: () => ({ resourceType: () => kind }),
			body,
			url: () => 'http://localhost/resource?token=private-token',
			status: () => 200,
		});
		onResponse(response('fetch', apiBody));
		onResponse(response('font', async () => Buffer.from('font bytes')));
		onResponse(
			response('image', async () => {
				throw new Error('unavailable');
			}),
		);
		const resources = await read();
		expect(apiBody).not.toHaveBeenCalled();
		expect(resources).toHaveLength(2);
		expect(resources[0].bodySha256).toMatch(/^[a-f0-9]{64}$/);
		expect(resources[1].bodySha256).toBeNull();
		expect(JSON.stringify(resources)).not.toContain('private-token');
	});
});
