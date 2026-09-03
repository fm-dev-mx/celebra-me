import { describe, expect, it } from '@jest/globals';
import {
	CanaryFailure,
	CanaryLifecycleGuard,
	VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION,
	VALENTINA_MEMORIES_PRODUCTION_CONFIRMATION,
	createTinyNonPiiPng,
	formatCanaryEvent,
	parseCanaryInvocation,
} from '../../../scripts/ops/valentina-memories-production-canary';

const TERMINAL = { stdin: true, stdout: true } as const;
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_PATH = `/api/memories/valentina/items/${MEDIA_ID}`;

function validArguments(): string[] {
	return [
		`--destination=${VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION}`,
		`--confirm-production=${VALENTINA_MEMORIES_PRODUCTION_CONFIRMATION}`,
	];
}

function expectFailure(action: () => unknown, stage: string, code: string): void {
	try {
		action();
		throw new Error('Expected CanaryFailure.');
	} catch (error) {
		expect(error).toBeInstanceOf(CanaryFailure);
		expect(error).toMatchObject({ stage, code });
	}
}

describe('Valentina Memories Production canary preflight', () => {
	it('accepts only the canonical Production route with the exact confirmation', () => {
		expect(parseCanaryInvocation(validArguments(), {}, TERMINAL)).toEqual({
			destination: 'https://www.celebra-me.com/r/valentina',
		});
	});

	it('accepts the package-manager argument separator before options', () => {
		expect(parseCanaryInvocation(['--', ...validArguments()], {}, TERMINAL)).toEqual({
			destination: 'https://www.celebra-me.com/r/valentina',
		});
	});

	it('rejects CI before a browser can be launched', () => {
		expectFailure(
			() => parseCanaryInvocation(validArguments(), { CI: 'true' }, TERMINAL),
			'preflight',
			'CI_EXECUTION_REJECTED',
		);
	});

	it('requires an interactive terminal', () => {
		expectFailure(
			() => parseCanaryInvocation(validArguments(), {}, { stdin: false, stdout: true }),
			'preflight',
			'INTERACTIVE_TERMINAL_REQUIRED',
		);
	});

	it.each([
		'https://celebra-me.com/r/valentina',
		'https://www.celebra-me.com/r/valentina/',
		'https://www.celebra-me.com/r/valentina?retry=1',
		'https://www.celebra-me.com/r/valentina#canary',
		'http://www.celebra-me.com/r/valentina',
	])('rejects noncanonical destination %s', (destination) => {
		expectFailure(
			() =>
				parseCanaryInvocation(
					[
						`--destination=${destination}`,
						`--confirm-production=${VALENTINA_MEMORIES_PRODUCTION_CONFIRMATION}`,
					],
					{},
					TERMINAL,
				),
			'preflight',
			'NONCANONICAL_DESTINATION_REJECTED',
		);
	});

	it('rejects missing or altered Production confirmation', () => {
		expectFailure(
			() =>
				parseCanaryInvocation(
					[
						`--destination=${VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION}`,
						'--confirm-production=yes',
					],
					{},
					TERMINAL,
				),
			'preflight',
			'PRODUCTION_CONFIRMATION_REJECTED',
		);
	});
});

describe('Valentina Memories Production canary lifecycle guard', () => {
	it('permits one lifecycle and only the existing three bounded completion attempts', () => {
		const guard = new CanaryLifecycleGuard();
		guard.observe({
			method: 'POST',
			url: 'https://www.celebra-me.com/api/memories/valentina/session',
			body: JSON.stringify({ action: 'create', displayName: 'Canario Valentina' }),
		});
		guard.observe({
			method: 'POST',
			url: 'https://www.celebra-me.com/api/memories/valentina/items',
			body: JSON.stringify({ action: 'reserve' }),
		});
		guard.observe({
			method: 'PUT',
			url: 'https://opaque-upload.example/object?capability=redacted',
			body: null,
		});
		guard.registerMediaId(MEDIA_ID);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			guard.observe({
				method: 'POST',
				url: `https://www.celebra-me.com${MEDIA_PATH}`,
				body: JSON.stringify({ action: 'complete' }),
			});
		}
		guard.observe({
			method: 'DELETE',
			url: `https://www.celebra-me.com${MEDIA_PATH}`,
			body: null,
		});

		expect(guard.counts()).toEqual({
			sessionCreations: 1,
			reservations: 1,
			puts: 1,
			completions: 3,
			deletes: 1,
		});
		expect(() => guard.assertSuccessfulLifecycle()).not.toThrow();
	});

	it.each([
		['session', 'POST', '/api/memories/valentina/session', { action: 'create' }],
		['reservation', 'POST', '/api/memories/valentina/items', { action: 'reserve' }],
	] as const)('rejects a second %s mutation', (stage, method, pathname, body) => {
		const guard = new CanaryLifecycleGuard();
		const observation = {
			method,
			url: `https://www.celebra-me.com${pathname}`,
			body: JSON.stringify(body),
		};
		guard.observe(observation);
		expectFailure(
			() => guard.observe(observation),
			stage,
			`${stage.toUpperCase()}_BOUNDARY_VIOLATION`,
		);
	});

	it('rejects a second PUT or DELETE and a fourth completion', () => {
		const putGuard = new CanaryLifecycleGuard();
		const put = { method: 'PUT', url: 'https://upload.example/capability', body: null };
		putGuard.observe(put);
		expectFailure(() => putGuard.observe(put), 'upload', 'PUT_BOUNDARY_VIOLATION');

		const mutationGuard = new CanaryLifecycleGuard();
		mutationGuard.registerMediaId(MEDIA_ID);
		const completion = {
			method: 'POST',
			url: `https://www.celebra-me.com${MEDIA_PATH}`,
			body: JSON.stringify({ action: 'complete' }),
		};
		mutationGuard.observe(completion);
		mutationGuard.observe(completion);
		mutationGuard.observe(completion);
		expectFailure(
			() => mutationGuard.observe(completion),
			'completion',
			'COMPLETION_BOUNDARY_VIOLATION',
		);

		const deletionGuard = new CanaryLifecycleGuard();
		deletionGuard.registerMediaId(MEDIA_ID);
		const deletion = {
			method: 'DELETE',
			url: `https://www.celebra-me.com${MEDIA_PATH}`,
			body: null,
		};
		deletionGuard.observe(deletion);
		expectFailure(
			() => deletionGuard.observe(deletion),
			'deletion',
			'DELETE_BOUNDARY_VIOLATION',
		);
	});

	it('rejects mutations against a second media lifecycle', () => {
		const guard = new CanaryLifecycleGuard();
		guard.registerMediaId(MEDIA_ID);
		expectFailure(
			() =>
				guard.observe({
					method: 'DELETE',
					url: 'https://www.celebra-me.com/api/memories/valentina/items/22222222-2222-4222-8222-222222222222',
					body: null,
				}),
			'cleanup',
			'MULTIPLE_MEDIA_LIFECYCLES_REJECTED',
		);
	});

	it('rejects a malformed media identifier before cleanup can target it', () => {
		const guard = new CanaryLifecycleGuard();
		expectFailure(
			() => guard.registerMediaId('11111111-1111-1111-1111-111111111111'),
			'reservation',
			'INVALID_MEDIA_ID',
		);
	});
});

describe('Valentina Memories Production canary evidence', () => {
	it('uses a tiny in-memory PNG without personal content', () => {
		const png = createTinyNonPiiPng();
		expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(png.byteLength).toBeLessThan(256);
	});

	it('formats only the sanitized evidence envelope', () => {
		const line = formatCanaryEvent({
			timestamp: '2026-08-31T00:00:00.000Z',
			stage: 'preview',
			status: 200,
			severity: 'INFO',
		});
		expect(JSON.parse(line)).toEqual({
			timestamp: '2026-08-31T00:00:00.000Z',
			stage: 'preview',
			status: 200,
			severity: 'INFO',
		});
		expect(line).not.toMatch(/cookie|signed|objectKey|checksum|token|requestBody/i);
	});
});
