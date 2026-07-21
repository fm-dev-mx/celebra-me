/**
 * Disposable application-level publication regression.
 *
 * It exercises the service's real REST client against an isolated PostgREST
 * container: preflight -> successful publish with discarded response -> exact
 * retry. The small URL adapter is only for bare PostgREST, which does not
 * provide Supabase's /rest/v1 gateway prefix.
 */
import { createHmac, randomUUID } from 'node:crypto';

const apiOrigin = 'http://127.0.0.1:54331';
const jwtSecret = 'super-secret-jwt-token-with-at-least-32-characters-long';

function base64Url(value: string): string {
	return Buffer.from(value).toString('base64url');
}

function serviceRoleToken(): string {
	const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64Url(
		JSON.stringify({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 300 }),
	);
	const signature = createHmac('sha256', jwtSecret)
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

async function request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
	const token = serviceRoleToken();
	return fetch(`${apiOrigin}/${path}`, {
		method,
		headers: {
			apikey: token,
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
	process.env.SUPABASE_URL = apiOrigin;
	process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleToken();
	process.env.SUPABASE_ANON_KEY = serviceRoleToken();
	const originalFetch = globalThis.fetch;
	globalThis.fetch = (input, init) => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		return originalFetch(url.replace('/rest/v1/', '/'), init);
	};

	const invitationId = randomUUID();
	const draftId = randomUUID();
	const slug = `application-retry-${invitationId.slice(0, 8)}`;
	const invitationResponse = await request('invitations', 'POST', {
		id: invitationId,
		slug,
		title: 'Prueba de reintento',
		event_type: 'xv',
		status: 'in_production',
		base_demo_id: 'demo-xv-jewelry-box',
		theme_id: 'jewelry-box',
		snapshot: { previewSlug: 'demo-xv-jewelry-box' },
		kind: 'demo',
	});
	if (!invitationResponse.ok)
		throw new Error(`Application setup invitation failed: ${await invitationResponse.text()}`);
	const draftResponse = await request('invitation_content_drafts', 'POST', {
		id: draftId,
		invitation_project_id: invitationId,
		content: {
			title: 'Prueba de reintento',
			eventTiming: { localDateTime: '2027-01-01T18:00', timeZone: 'America/Chihuahua' },
		},
		status: 'draft',
	});
	if (!draftResponse.ok)
		throw new Error(`Application setup draft failed: ${await draftResponse.text()}`);

	const { getPublicationPreflight, publishDraft } =
		await import('@/lib/intake/services/publishing.service');
	const preflight = await getPublicationPreflight(invitationId);
	const idempotencyKey = randomUUID();
	// Simulate a dropped HTTP response after the service completed the publication.
	try {
		await publishDraft(invitationId, { ...preflight, idempotencyKey });
	} catch (error) {
		const refreshed = await getPublicationPreflight(invitationId);
		throw new Error(
			`Initial publish failed (reviewed=${preflight.projectionHash}, refreshed=${refreshed.projectionHash}): ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
	const replay = await publishDraft(invitationId, { ...preflight, idempotencyKey });
	assert(replay.publishedContent.version === 1, 'Retry incremented the published version.');
	assert(replay.idempotent === false, 'Replay changed the persisted idempotency indicator.');

	const publishedResponse = await request(
		`published_invitation_content?invitation_project_id=eq.${encodeURIComponent(invitationId)}&select=version`,
		'GET',
	);
	if (!publishedResponse.ok)
		throw new Error(`Application verification read failed: ${await publishedResponse.text()}`);
	const published = (await publishedResponse.json()) as Array<{ version: number }>;
	assert(
		published.length === 1 && published[0]?.version === 1,
		'Expected exactly one published version.',
	);

	console.info('Application publication retry flow passed.');
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
