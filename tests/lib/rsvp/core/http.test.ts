import { errorResponse, parseJsonBody, readBoundedRequestBytes } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { Request as NodeRequest } from 'undici';

type NodeRequestInit = ConstructorParameters<typeof NodeRequest>[1];

describe('errorResponse — stack trace / secret exposure regression (CodeQL: Information exposure)', () => {
	it('never leaks error.message for a non-ApiError Error instance containing a stack trace', () => {
		const error = new Error(
			'ReferenceError: X is not defined\n    at Object.<anonymous> (/app/src/something.ts:42:5)',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
		expect(body.error.message).toBe('Internal server error.');
		// Must not contain stack trace or internal paths
		expect(body.error.message).not.toContain('ReferenceError');
		expect(body.error.message).not.toContain('/app/src/');
	});

	it('never leaks error.message for an Error instance with a DB URL in its message', () => {
		const error = new Error(
			'Connection refused: postgresql://postgres:secret@db.internal.supabase.co:5432/postgres',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.message).toBe('Internal server error.');
		expect(body.error.message).not.toContain('postgresql://');
		expect(body.error.message).not.toContain('supabase.co');
		expect(body.error.message).not.toContain('secret');
	});

	it('never leaks error.message for an Error instance with a SQL query in its message', () => {
		const error = new Error(
			'ERROR: 42P01 relation "secrets.private_keys" does not exist\n  at Parser.parseError',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.message).toBe('Internal server error.');
		expect(body.error.message).not.toContain('42P01');
		expect(body.error.message).not.toContain('secrets');
	});

	it('still returns ApiError code and message unchanged', () => {
		const response = errorResponse(new ApiError(404, 'not_found', 'Invitación no encontrada.'));
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('not_found');
		expect(body.error.message).toBe('Invitación no encontrada.');
	});

	it('returns 400 with generic message for plain string errors', () => {
		const response = errorResponse('Something went wrong');
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
		expect(body.error.message).toBe('Internal server error.');
	});

	it('returns 400 with generic message for empty objects', () => {
		const response = errorResponse({});
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('bad_request');
		expect(body.error.message).toBe('Internal server error.');
	});

	it('does not expose ApiError diagnostics for server errors', async () => {
		const response = errorResponse(
			new ApiError(500, 'internal_error', 'Internal server error.', {
				provider: 'postgres',
				query: 'select secret from private_table',
			}),
		);
		const body = await response.json();

		expect(body.error).toEqual({
			code: 'internal_error',
			message: 'Internal server error.',
		});
	});
});

describe('bounded request body readers', () => {
	function requestFromStream(
		stream: ReadableStream<Uint8Array>,
		headers: Record<string, string> = {},
	): Request {
		const init = {
			method: 'POST',
			headers,
			body: stream,
			duplex: 'half',
		} as unknown as NodeRequestInit;
		return new NodeRequest('http://localhost/api/test', init) as unknown as Request;
	}

	it('rejects a misleadingly small Content-Length after reading actual bytes', async () => {
		const request = requestFromStream(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('123456'));
					controller.close();
				},
			}),
			{ 'content-length': '1' },
		);

		await expect(readBoundedRequestBytes(request, 5)).rejects.toMatchObject({
			status: 413,
			code: 'payload_too_large',
		});
	});

	it('cancels the source stream at the byte limit', async () => {
		let cancelled = false;
		const request = requestFromStream(
			new ReadableStream<Uint8Array>({
				pull(controller) {
					controller.enqueue(new Uint8Array(6));
				},
				cancel() {
					cancelled = true;
				},
			}),
		);

		await expect(readBoundedRequestBytes(request, 5)).rejects.toMatchObject({ status: 413 });
		expect(cancelled).toBe(true);
	});

	it('rejects invalid Content-Length before consuming the body', async () => {
		const request = requestFromStream(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array([1]));
					controller.close();
				},
			}),
			{ 'content-length': 'not-a-number' },
		);

		await expect(readBoundedRequestBytes(request, 5)).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
		});
	});

	it('does not use an unbounded text fallback when the request has no stream', async () => {
		const text = jest.fn(async () => 'this must not be read');
		const request = { headers: new Headers(), body: null, text } as unknown as Request;

		await expect(readBoundedRequestBytes(request, 5)).resolves.toEqual(new Uint8Array(0));
		expect(text).not.toHaveBeenCalled();
	});

	it('maps oversized JSON to a 413 response through the shared parser', async () => {
		const result = await parseJsonBody(
			new NodeRequest('http://localhost/api/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ value: '123456' }),
			} as unknown as NodeRequestInit) as unknown as Request,
			5,
		);

		expect(result).toBeInstanceOf(Response);
		if (result instanceof Response) {
			expect(result.status).toBe(413);
			expect((await result.json()).error.code).toBe('payload_too_large');
		}
	});
});
