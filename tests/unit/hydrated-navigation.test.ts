import type { Response } from '@playwright/test';
import { gotoAfterIslandEffect } from '../e2e/harness/hydrated-navigation';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((accept, fail) => {
		resolve = accept;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe('island effect navigation', () => {
	test('registers the response listener before navigation and waits for both signals', async () => {
		const response = deferred<Response>();
		const navigation = deferred<null>();
		const calls: string[] = [];
		const page = {
			waitForResponse: jest.fn(() => {
				calls.push('listen');
				return response.promise;
			}),
			goto: jest.fn(() => {
				calls.push('navigate');
				return navigation.promise;
			}),
		};
		let ready = false;
		const result = gotoAfterIslandEffect(page, '/example', '**/api/example').then(() => {
			ready = true;
		});
		expect(calls).toEqual(['listen', 'navigate']);
		expect(page.waitForResponse).toHaveBeenCalledWith('**/api/example');
		expect(page.goto).toHaveBeenCalledWith('/example', { waitUntil: 'domcontentloaded' });
		navigation.resolve(null);
		await navigation.promise;
		expect(ready).toBe(false);
		response.resolve({} as Response);
		await result;
		expect(ready).toBe(true);
	});

	test('does not finish when the response arrives before navigation completes', async () => {
		const navigation = deferred<null>();
		let ready = false;
		const result = gotoAfterIslandEffect(
			{ waitForResponse: async () => ({}) as Response, goto: () => navigation.promise },
			'/example',
			'**/api/example',
		).then(() => {
			ready = true;
		});
		await Promise.resolve();
		expect(ready).toBe(false);
		navigation.resolve(null);
		await result;
		expect(ready).toBe(true);
	});

	test.each(['navigation', 'response'] as const)(
		'propagates a %s failure and still observes the other pending rejection',
		async (first) => {
			const navigation = deferred<null>();
			const response = deferred<Response>();
			const result = gotoAfterIslandEffect(
				{ waitForResponse: () => response.promise, goto: () => navigation.promise },
				'/example',
				'**/api/example',
			);
			const failure = new Error(first);
			const assertion = expect(result).rejects.toBe(failure);
			(first === 'navigation' ? navigation : response).reject(failure);
			await assertion;
			(first === 'navigation' ? response : navigation).reject(new Error('late failure'));
			await Promise.resolve();
		},
	);
});
