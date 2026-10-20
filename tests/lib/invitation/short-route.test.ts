import { resolveShortRouteEventType } from '@/lib/invitation/short-route';

describe('resolveShortRouteEventType', () => {
	const lookup = jest.fn();

	beforeEach(() => {
		lookup.mockReset();
	});

	it('returns the event type of a published slug', async () => {
		lookup.mockResolvedValue('xv');
		await expect(resolveShortRouteEventType('america', lookup)).resolves.toBe('xv');
		expect(lookup).toHaveBeenCalledWith('america');
	});

	it.each(['dashboard', 'login', 'api', 'i', 'r', 'xv', 'boda', 'vista-previa'])(
		'answers null for the reserved slug %s without querying',
		async (slug) => {
			await expect(resolveShortRouteEventType(slug, lookup)).resolves.toBeNull();
			expect(lookup).not.toHaveBeenCalled();
		},
	);

	it('answers null for an unknown or ambiguous slug', async () => {
		lookup.mockResolvedValue(null);
		await expect(resolveShortRouteEventType('nadie', lookup)).resolves.toBeNull();
	});

	it('answers null when the stored event type is unsupported', async () => {
		lookup.mockResolvedValue('quinceanera');
		await expect(resolveShortRouteEventType('america', lookup)).resolves.toBeNull();
	});

	it('fails closed when the lookup throws', async () => {
		const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		lookup.mockRejectedValue(new Error('db down'));
		await expect(resolveShortRouteEventType('america', lookup)).resolves.toBeNull();
		spy.mockRestore();
	});
});
