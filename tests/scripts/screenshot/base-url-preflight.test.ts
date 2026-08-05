import { assertScreenshotBaseUrlReachable } from '../../../scripts/screenshot/base-url-preflight';
import { ScreenshotScopeError } from '../../../scripts/screenshot/scope';

describe('screenshot base URL preflight', () => {
	it('resolves when fetch succeeds', async () => {
		await expect(
			assertScreenshotBaseUrlReachable('http://localhost:4322', {
				fetchImpl: async () => undefined,
			}),
		).resolves.toBeUndefined();
	});

	it('fails closed with a pnpm dev hint when the server is unreachable', async () => {
		let error: unknown;
		try {
			await assertScreenshotBaseUrlReachable('http://localhost:4322', {
				fetchImpl: async () => {
					throw new Error('ECONNREFUSED');
				},
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(ScreenshotScopeError);
		expect(error).toMatchObject({
			name: 'ScreenshotScopeError',
			code: 'BASE_URL_UNREACHABLE',
		} satisfies Partial<ScreenshotScopeError>);
		expect((error as Error).message).toContain('pnpm dev');
		expect((error as Error).message).toContain('http://localhost:4322');
	});
});
