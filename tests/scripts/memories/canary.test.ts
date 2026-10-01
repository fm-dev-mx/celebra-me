import {
	buildMemoriesGuestApiPath,
	buildMemoriesPublicPath,
} from '@/lib/memories/contract/private-request';
import {
	CanaryFailure,
	CanaryLifecycleGuard,
	MEMORIES_CANONICAL_APP_ORIGIN,
	MEMORIES_PRODUCTION_CONFIRMATION,
	buildCanaryDestination,
	createTinyNonPiiPng,
	formatCanaryEvent,
	parseCanaryInvocation,
} from '../../../scripts/ops/memories-production-canary';

const TERMINAL = { stdin: true, stdout: true } as const;
const SLUG = 'victoria-y-roberto';
const DESTINATION = `https://www.celebra-me.com/r/${SLUG}`;
const SESSION_PATH = `/api/memories/${SLUG}/session`;
const ITEMS_PATH = `/api/memories/${SLUG}/items`;
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_PATH = `${ITEMS_PATH}/${MEDIA_ID}`;
const EXPECTED_INVOCATION = {
	slug: SLUG,
	destination: DESTINATION,
	sessionPath: SESSION_PATH,
	itemsPath: ITEMS_PATH,
};

function validArguments(
	overrides: Partial<Record<'slug' | 'destination' | 'confirm-production', string>> = {},
): string[] {
	const values = {
		slug: SLUG,
		destination: DESTINATION,
		'confirm-production': MEMORIES_PRODUCTION_CONFIRMATION,
		...overrides,
	};
	return Object.entries(values).map(([key, value]) => `--${key}=${value}`);
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

function createGuard(): CanaryLifecycleGuard {
	return new CanaryLifecycleGuard({ sessionPath: SESSION_PATH, itemsPath: ITEMS_PATH });
}

describe('memories Production canary preflight', () => {
	it('derives the canonical www destination and guest API paths from the slug', () => {
		expect(MEMORIES_CANONICAL_APP_ORIGIN).toBe('https://www.celebra-me.com');
		expect(buildCanaryDestination(SLUG)).toBe(DESTINATION);
		expect(buildCanaryDestination(SLUG)).toBe(
			`${MEMORIES_CANONICAL_APP_ORIGIN}${buildMemoriesPublicPath(SLUG)}`,
		);
		expect(SESSION_PATH).toBe(`${buildMemoriesGuestApiPath(SLUG)}/session`);
		expect(ITEMS_PATH).toBe(`${buildMemoriesGuestApiPath(SLUG)}/items`);
	});

	it('accepts only the canonical Production route with the exact confirmation', () => {
		expect(parseCanaryInvocation(validArguments(), {}, TERMINAL)).toEqual(EXPECTED_INVOCATION);
	});

	it('accepts the package-manager argument separator before options', () => {
		expect(parseCanaryInvocation(['--', ...validArguments()], {}, TERMINAL)).toEqual(
			EXPECTED_INVOCATION,
		);
	});

	it.each([
		'CI',
		'GITHUB_ACTIONS',
		'GITLAB_CI',
		'BUILDKITE',
		'CIRCLECI',
		'TF_BUILD',
		'JENKINS_URL',
		'TEAMCITY_VERSION',
	])('rejects CI marker %s before a browser can be launched', (marker) => {
		expectFailure(
			() => parseCanaryInvocation(validArguments(), { [marker]: 'true' }, TERMINAL),
			'preflight',
			'CI_EXECUTION_REJECTED',
		);
	});

	it('requires an interactive terminal on both stdin and stdout', () => {
		expectFailure(
			() => parseCanaryInvocation(validArguments(), {}, { stdin: false, stdout: true }),
			'preflight',
			'INTERACTIVE_TERMINAL_REQUIRED',
		);
		expectFailure(
			() => parseCanaryInvocation(validArguments(), {}, { stdin: true, stdout: false }),
			'preflight',
			'INTERACTIVE_TERMINAL_REQUIRED',
		);
	});

	it.each([
		'Victoria-Y-Roberto',
		'victoria_y_roberto',
		'-victoria',
		'victoria--roberto',
		'victoria y roberto',
		'a'.repeat(65),
	])('rejects invalid slug %s', (slug) => {
		expectFailure(
			() =>
				parseCanaryInvocation(
					validArguments({ slug, destination: `https://www.celebra-me.com/r/${slug}` }),
					{},
					TERMINAL,
				),
			'preflight',
			'INVALID_SLUG',
		);
	});

	it.each([
		`https://celebra-me.com/r/${SLUG}`,
		`https://www.celebra-me.com/r/${SLUG}/`,
		`https://www.celebra-me.com/r/${SLUG}?retry=1`,
		`https://www.celebra-me.com/r/${SLUG}#canary`,
		`http://www.celebra-me.com/r/${SLUG}`,
		`https://www.celebra-me.com/r/otro-evento`,
		`https://celebra-me.vercel.app/r/${SLUG}`,
		'not a url',
	])('rejects noncanonical destination %s', (destination) => {
		expectFailure(
			() => parseCanaryInvocation(validArguments({ destination }), {}, TERMINAL),
			'preflight',
			'NONCANONICAL_DESTINATION_REJECTED',
		);
	});

	it('rejects missing or altered Production confirmation', () => {
		expectFailure(
			() =>
				parseCanaryInvocation(
					validArguments({ 'confirm-production': 'yes' }),
					{},
					TERMINAL,
				),
			'preflight',
			'PRODUCTION_CONFIRMATION_REJECTED',
		);
		expectFailure(
			() =>
				parseCanaryInvocation(
					validArguments({
						'confirm-production': MEMORIES_PRODUCTION_CONFIRMATION.toLowerCase(),
					}),
					{},
					TERMINAL,
				),
			'preflight',
			'PRODUCTION_CONFIRMATION_REJECTED',
		);
	});

	it('requires slug, destination and confirmation together and refuses anything else', () => {
		expectFailure(
			() =>
				parseCanaryInvocation(
					[
						`--destination=${DESTINATION}`,
						`--confirm-production=${MEMORIES_PRODUCTION_CONFIRMATION}`,
					],
					{},
					TERMINAL,
				),
			'preflight',
			'REQUIRED_ARGUMENT_MISSING',
		);
		expectFailure(
			() => parseCanaryInvocation([...validArguments(), '--headless=false'], {}, TERMINAL),
			'preflight',
			'UNKNOWN_ARGUMENT',
		);
		expectFailure(
			() => parseCanaryInvocation([...validArguments(), '--slug'], {}, TERMINAL),
			'preflight',
			'INVALID_ARGUMENT',
		);
		expectFailure(
			() => parseCanaryInvocation([...validArguments(), `--slug=${SLUG}`], {}, TERMINAL),
			'preflight',
			'DUPLICATE_ARGUMENT',
		);
	});
});

describe('memories Production canary lifecycle guard', () => {
	it('permits one lifecycle and only the existing three bounded completion attempts', () => {
		const guard = createGuard();
		guard.observe({
			method: 'POST',
			url: `https://www.celebra-me.com${SESSION_PATH}`,
			body: JSON.stringify({ action: 'create', displayName: 'Canario sintético' }),
		});
		guard.observe({
			method: 'POST',
			url: `https://www.celebra-me.com${ITEMS_PATH}`,
			body: JSON.stringify({ action: 'reserve' }),
		});
		guard.observe({
			method: 'PUT',
			url: 'https://celebra-memories-sign.example.workers.dev/upload',
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
		expect(guard.reservationAttempted).toBe(true);
		expect(guard.deleteAttempted).toBe(true);
		expect(() => guard.assertSuccessfulLifecycle()).not.toThrow();
	});

	it('ignores reads, other origins and other events while counting nothing', () => {
		const guard = createGuard();
		guard.observe({
			method: 'GET',
			url: `https://www.celebra-me.com${SESSION_PATH}`,
			body: null,
		});
		guard.observe({
			method: 'GET',
			url: `https://www.celebra-me.com${ITEMS_PATH}`,
			body: null,
		});
		guard.observe({
			method: 'POST',
			url: `https://celebra-me.vercel.app${SESSION_PATH}`,
			body: JSON.stringify({ action: 'create' }),
		});
		guard.observe({
			method: 'POST',
			url: 'https://www.celebra-me.com/api/memories/otro-evento/session',
			body: JSON.stringify({ action: 'create' }),
		});
		guard.observe({
			method: 'POST',
			url: 'https://www.celebra-me.com/api/memories/otro-evento/items',
			body: JSON.stringify({ action: 'reserve' }),
		});

		expect(guard.counts()).toEqual({
			sessionCreations: 0,
			reservations: 0,
			puts: 0,
			completions: 0,
			deletes: 0,
		});
		expectFailure(
			() => guard.assertSuccessfulLifecycle(),
			'result',
			'LIFECYCLE_COUNT_MISMATCH',
		);
	});

	it.each([
		['session', 'POST', SESSION_PATH, { action: 'create' }],
		['reservation', 'POST', ITEMS_PATH, { action: 'reserve' }],
	] as const)('rejects a second %s mutation', (stage, method, pathname, body) => {
		const guard = createGuard();
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

	it.each([
		['session', 'POST', SESSION_PATH, { action: 'recover' }],
		['reservation', 'POST', ITEMS_PATH, { action: 'complete' }],
	] as const)(
		'rejects a %s request with an unexpected action',
		(stage, method, pathname, body) => {
			const guard = createGuard();
			expectFailure(
				() =>
					guard.observe({
						method,
						url: `https://www.celebra-me.com${pathname}`,
						body: JSON.stringify(body),
					}),
				stage,
				`${stage.toUpperCase()}_BOUNDARY_VIOLATION`,
			);
		},
	);

	it('rejects a second PUT, an insecure PUT and a PUT against the app origin', () => {
		const put = { method: 'PUT', url: 'https://upload.example/upload', body: null };
		const secondPut = createGuard();
		secondPut.observe(put);
		expectFailure(() => secondPut.observe(put), 'upload', 'PUT_BOUNDARY_VIOLATION');

		expectFailure(
			() =>
				createGuard().observe({
					method: 'PUT',
					url: 'http://upload.example/upload',
					body: null,
				}),
			'upload',
			'PUT_BOUNDARY_VIOLATION',
		);
		expectFailure(
			() =>
				createGuard().observe({
					method: 'PUT',
					url: `https://www.celebra-me.com${MEDIA_PATH}`,
					body: null,
				}),
			'upload',
			'PUT_BOUNDARY_VIOLATION',
		);
	});

	it('rejects a fourth completion and a second DELETE', () => {
		const completionGuard = createGuard();
		completionGuard.registerMediaId(MEDIA_ID);
		const completion = {
			method: 'POST',
			url: `https://www.celebra-me.com${MEDIA_PATH}`,
			body: JSON.stringify({ action: 'complete' }),
		};
		completionGuard.observe(completion);
		completionGuard.observe(completion);
		completionGuard.observe(completion);
		expectFailure(
			() => completionGuard.observe(completion),
			'completion',
			'COMPLETION_BOUNDARY_VIOLATION',
		);

		const deletionGuard = createGuard();
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
		const guard = createGuard();
		guard.registerMediaId(MEDIA_ID);
		expectFailure(
			() =>
				guard.observe({
					method: 'DELETE',
					url: `https://www.celebra-me.com${ITEMS_PATH}/22222222-2222-4222-8222-222222222222`,
					body: null,
				}),
			'cleanup',
			'MULTIPLE_MEDIA_LIFECYCLES_REJECTED',
		);
	});

	it('rejects a malformed media identifier and a registration that contradicts observed traffic', () => {
		expectFailure(
			() => createGuard().registerMediaId('11111111-1111-1111-1111-111111111111'),
			'reservation',
			'INVALID_MEDIA_ID',
		);
		expectFailure(
			() => createGuard().registerMediaId('not-a-uuid'),
			'reservation',
			'INVALID_MEDIA_ID',
		);

		const guard = createGuard();
		guard.observe({
			method: 'POST',
			url: `https://www.celebra-me.com${ITEMS_PATH}/22222222-2222-4222-8222-222222222222`,
			body: JSON.stringify({ action: 'complete' }),
		});
		expectFailure(() => guard.registerMediaId(MEDIA_ID), 'reservation', 'MEDIA_ID_MISMATCH');
	});
});

describe('memories Production canary evidence', () => {
	it('uses a tiny in-memory PNG without personal content', () => {
		const png = createTinyNonPiiPng();
		expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(png.byteLength).toBeLessThan(256);
		expect(createTinyNonPiiPng()).not.toBe(png);
	});

	it('formats only the sanitized evidence envelope', () => {
		const line = formatCanaryEvent({
			timestamp: '2026-10-03T00:00:00.000Z',
			stage: 'preview',
			status: 200,
			severity: 'INFO',
		});
		expect(JSON.parse(line)).toEqual({
			timestamp: '2026-10-03T00:00:00.000Z',
			stage: 'preview',
			status: 200,
			severity: 'INFO',
		});
		expect(line).not.toMatch(/cookie|signed|objectKey|checksum|token|requestBody/i);
	});
});
