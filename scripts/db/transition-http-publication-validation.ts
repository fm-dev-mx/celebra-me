/**
 * Disposable-only State A validation: real Astro HTTP -> service -> repository
 * -> PostgREST. The local gateway supplies synthetic auth and records only
 * RPC shapes/statuses; it never receives production credentials.
 */
import { createHmac, randomUUID } from 'node:crypto';
import {
	createServer,
	request as httpRequest,
	type IncomingMessage,
	type ServerResponse,
} from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';

const gatewayPort = 54335;
const appPort = 4322;
const postgrestOrigin = 'http://127.0.0.1:54331';
const gatewayOrigin = `http://127.0.0.1:${gatewayPort}`;
const appOrigin = `http://localhost:${appPort}`;
const jwtSecret = process.env.TRANSITION_VALIDATION_JWT_SECRET;
const adminId = 'a0000000-0000-0000-0000-000000000001';

interface RpcTrace {
	shape: 'new' | 'legacy';
	status: number;
	code: string | null;
}

const rpcTraces: RpcTrace[] = [];

function base64Url(value: string): string {
	return Buffer.from(value).toString('base64url');
}

function token(): string {
	if (!jwtSecret) throw new Error('Setup failure: TRANSITION_VALIDATION_JWT_SECRET is required.');
	const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64Url(
		JSON.stringify({
			role: 'service_role',
			sub: adminId,
			aal: 'aal2',
			exp: Math.floor(Date.now() / 1000) + 600,
		}),
	);
	const signature = createHmac('sha256', jwtSecret)
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of request)
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/**
 * Allowed path prefixes for the local PostgREST proxy.
 * The Astro app only interacts with these Supabase API routes during validation.
 */
const ALLOWED_PATH_PREFIXES = ['/rest/v1/', '/auth/v1/'] as const;

/** Allowed HTTP methods for proxied requests. */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

/**
 * Validates that the target path is safe to proxy.
 * Rejects absolute URLs, protocol-relative URLs, path traversal, and
 * unexpected path prefixes before any fetch call.
 */
function assertSafeProxyPath(targetPath: string): void {
	// Reject protocol-relative or absolute URL patterns
	if (
		targetPath.startsWith('//') ||
		targetPath.startsWith('http://') ||
		targetPath.startsWith('https://')
	) {
		throw new Error(`Rejected unsafe path (absolute/protocol-relative): ${targetPath}`);
	}

	// Reject path traversal
	if (targetPath.includes('..')) {
		throw new Error(`Rejected unsafe path (traversal): ${targetPath}`);
	}

	// Reject null-byte injection
	if (targetPath.includes('\0')) {
		throw new Error('Rejected unsafe path (null byte)');
	}

	// Ensure the normalized path starts with an allowed prefix
	const normalized = targetPath.split('?')[0] ?? targetPath;
	if (!ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
		throw new Error(`Rejected unexpected path prefix: ${normalized}`);
	}
}

async function proxy(request: IncomingMessage, response: ServerResponse): Promise<void> {
	// Validate HTTP method
	if (!ALLOWED_METHODS.has(request.method ?? 'GET')) {
		response.writeHead(405, { 'content-type': 'application/json' });
		response.end(
			JSON.stringify({
				code: 'method_not_allowed',
				message: `Method ${request.method} is not allowed.`,
			}),
		);
		return;
	}

	const url = new URL(request.url ?? '/', gatewayOrigin);
	if (url.pathname === '/auth/v1/user') {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(
			JSON.stringify({
				id: adminId,
				email: 'admin@validation.test',
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'totp' }],
			}),
		);
		return;
	}

	const body = await readBody(request);
	const targetPath = url.pathname.startsWith('/rest/v1/')
		? `${url.pathname.replace('/rest/v1', '')}${url.search}`
		: `${url.pathname}${url.search}`;

	// Validate path safety before proxying
	assertSafeProxyPath(targetPath);

	// Proxy via Node http.request with a hardcoded hostname — the path is
	// validated by assertSafeProxyPath, and the host is never user-controlled.
	// SSRF risk is eliminated because only path traversal and prefix are
	// attacker-accessible; the target host is fixed.
	const httpOptions = {
		hostname: '127.0.0.1',
		port: 54331,
		path: targetPath,
		method: request.method,
		headers: request.headers as Record<string, string>,
	};
	const proxyReq = httpRequest(httpOptions, (proxyRes: IncomingMessage) => {
		if (targetPath.startsWith('/rpc/publish_invitation_atomic') && request.method === 'POST') {
			const chunks: Buffer[] = [];
			proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
			proxyRes.on('end', () => {
				const raw = Buffer.concat(chunks).toString('utf8');
				let parsed: Record<string, unknown> = {};
				try {
					parsed = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
				} catch {
					/* ignore invalid JSON body */
				}
				const shape = 'p_expected_published_version' in parsed ? 'new' : 'legacy';
				let code: string | null = null;
				try {
					code = (JSON.parse(raw) as { code?: string }).code ?? null;
				} catch {
					/* non-JSON error bodies are recorded as no code */
				}
				rpcTraces.push({ shape, status: proxyRes.statusCode ?? 200, code });
			});
		}
		response.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
		proxyRes.pipe(response);
	});
	proxyReq.end(body);
}

async function waitFor(url: string): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt++) {
		try {
			if ((await fetch(url)).status < 500) return;
		} catch {
			/* wait */
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Timed out waiting for ${url}`);
}

async function assertPortAvailable(port: number): Promise<void> {
	const probe = createServer();
	await new Promise<void>((resolve, reject) => {
		probe.once('error', () =>
			reject(new Error(`Setup failure: port ${port} is already in use.`)),
		);
		probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
	});
}

async function stopApp(app: ChildProcess | undefined): Promise<void> {
	if (!app || app.killed || !app.pid) return;
	if (process.platform !== 'win32') {
		app.kill();
		return;
	}
	await new Promise<void>((resolve) => {
		const taskkill = spawn('taskkill', ['/pid', String(app.pid), '/t', '/f'], {
			stdio: 'ignore',
		});
		taskkill.once('close', () => resolve());
		taskkill.once('error', () => resolve());
	});
	await new Promise<void>((resolve) => {
		const command = `$listener = Get-NetTCPConnection -LocalPort ${appPort} -State Listen -ErrorAction SilentlyContinue; if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }`;
		const cleanup = spawn(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-Command', command],
			{ stdio: 'ignore' },
		);
		cleanup.once('close', () => resolve());
		cleanup.once('error', () => resolve());
	});
}

async function rest(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
	const accessToken = token();
	return fetch(`${gatewayOrigin}/rest/v1/${path}`, {
		method,
		headers: {
			apikey: accessToken,
			Authorization: `Bearer ${accessToken}`,
			'content-type': 'application/json',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

async function main(): Promise<void> {
	if (process.env.TRANSITION_HTTP_VALIDATION !== '1') {
		throw new Error(
			'Setup failure: set TRANSITION_HTTP_VALIDATION=1 to authorize disposable HTTP validation.',
		);
	}
	if (postgrestOrigin !== 'http://127.0.0.1:54331') {
		throw new Error(
			'Setup failure: HTTP validation only permits the disposable PostgREST target.',
		);
	}
	await assertPortAvailable(appPort);
	await assertPortAvailable(gatewayPort);
	const gateway = createServer((request, response) => {
		void proxy(request, response).catch((error: unknown) => {
			response.writeHead(502, { 'content-type': 'application/json' });
			response.end(
				JSON.stringify({
					code: 'gateway_failure',
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		});
	});
	await new Promise<void>((resolve) => gateway.listen(gatewayPort, '127.0.0.1', resolve));

	let app: ChildProcess | undefined;
	try {
		app = spawn(
			process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
			['dev', '--port', String(appPort)],
			{
				cwd: process.cwd(),
				env: {
					...process.env,
					SUPABASE_URL: gatewayOrigin,
					SUPABASE_ANON_KEY: token(),
					SUPABASE_SERVICE_ROLE_KEY: token(),
					NODE_ENV: 'development',
				},
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: process.platform === 'win32',
			},
		);
		app.stdout?.on('data', (chunk: Buffer) =>
			process.stderr.write(`[astro] ${chunk.toString()}`),
		);
		app.stderr?.on('data', (chunk: Buffer) =>
			process.stderr.write(`[astro] ${chunk.toString()}`),
		);
		await waitFor(appOrigin);

		const invitationId = randomUUID();
		const draftId = randomUUID();
		const slug = `transition-http-${invitationId.slice(0, 8)}`;
		const invitation = await rest('invitations', 'POST', {
			id: invitationId,
			slug,
			title: 'Validación HTTP transicional',
			event_type: 'xv',
			status: 'in_production',
			base_demo_id: 'demo-xv-jewelry-box',
			theme_id: 'jewelry-box',
			snapshot: { previewSlug: 'demo-xv-jewelry-box' },
			created_by: adminId,
			kind: 'client',
		});
		if (!invitation.ok)
			throw new Error(`Synthetic invitation setup failed: ${await invitation.text()}`);
		const draft = await rest('invitation_content_drafts', 'POST', {
			id: draftId,
			invitation_project_id: invitationId,
			status: 'draft',
			content: {
				title: 'Validación HTTP transicional',
				hero: { name: 'Validación HTTP transicional', date: '2027-01-02T00:00:00.000Z' },
				eventTiming: { localDateTime: '2027-01-01T18:00', timeZone: 'America/Chihuahua' },
			},
		});
		if (!draft.ok) throw new Error(`Synthetic draft setup failed: ${await draft.text()}`);

		const accessToken = token();
		const authHeaders = {
			Authorization: `Bearer ${accessToken}`,
			Cookie: `csrf-token=validation-csrf; sb-access-token=${accessToken}`,
			'x-csrf-token': 'validation-csrf',
			'content-type': 'application/json',
		};
		const preflightResponse = await fetch(
			`${appOrigin}/api/dashboard/intake/${invitationId}/editor/preflight`,
			{ headers: authHeaders },
		);
		if (!preflightResponse.ok)
			throw new Error(`HTTP preflight failed: ${await preflightResponse.text()}`);
		const preflight = (await preflightResponse.json()) as {
			draftRevision: string;
			publishedVersion: number | null;
			publicMetadataHash: string;
			projectionHash: string;
			changedSections: unknown[];
		};
		assert(preflight.publishedVersion === null, 'State A should begin without public content.');
		const publishResponse = await fetch(
			`${appOrigin}/api/dashboard/intake/${invitationId}/editor/publish`,
			{
				method: 'POST',
				headers: authHeaders,
				body: JSON.stringify({ ...preflight, idempotencyKey: randomUUID() }),
			},
		);
		if (!publishResponse.ok)
			throw new Error(`HTTP publish failed: ${await publishResponse.text()}`);
		const published = (await publishResponse.json()) as {
			publishedContent: { version: number };
			context: { publication: { hasUnpublishedChanges: boolean; version: number | null } };
		};
		assert(
			published.publishedContent.version === 1,
			'Legacy publication did not create public version 1.',
		);
		assert(
			!published.context.publication.hasUnpublishedChanges &&
				published.context.publication.version === 1,
			'Committed editor baseline was not returned.',
		);
		const freshPreflight = await fetch(
			`${appOrigin}/api/dashboard/intake/${invitationId}/editor/preflight`,
			{ headers: authHeaders },
		);
		assert(
			freshPreflight.status === 409,
			'Consumed preflight should not remain publishable after legacy success.',
		);
		const publicPage = await fetch(`${appOrigin}/xv/${slug}`);
		assert(publicPage.ok, `Public invitation route failed: ${publicPage.status}`);
		assert(
			(await publicPage.text()).includes('Validación HTTP transicional'),
			'Public route did not render published content.',
		);

		assert(
			rpcTraces.length === 2,
			`Expected exactly two RPC attempts, got ${rpcTraces.length}.`,
		);
		assert(
			rpcTraces[0]?.shape === 'new' && rpcTraces[0]?.code === 'PGRST202',
			'New RPC was not attempted first with verified PGRST202.',
		);
		assert(
			rpcTraces[1]?.shape === 'legacy' && rpcTraces[1]?.status === 200,
			'Legacy RPC was not called exactly once after PGRST202.',
		);
		console.info(
			JSON.stringify(
				{
					state: 'A',
					priorVersion: null,
					resultingVersion: 1,
					changedSections: preflight.changedSections.length,
					rpcTraces,
				},
				null,
				2,
			),
		);
	} finally {
		await stopApp(app);
		await new Promise<void>((resolve) => gateway.close(() => resolve()));
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
	process.exit(1);
});
