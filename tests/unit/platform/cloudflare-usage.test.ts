import { classifyR2Operations } from '@/lib/platform/server/cloudflare-usage';

describe('classifyR2Operations', () => {
	it('counts unknown actions as Class A and skips free ones', () => {
		expect(
			classifyR2Operations([
				{ sum: { requests: 2 }, dimensions: { actionType: 'SomeNewWrite' } },
				{ sum: { requests: 3 }, dimensions: { actionType: 'AbortMultipartUpload' } },
				{ sum: { requests: 4 }, dimensions: { actionType: 'HeadBucket' } },
			]),
		).toEqual({ classA: 2, classB: 4 });
	});

	it('rejects malformed rows instead of under-reporting', () => {
		expect(
			classifyR2Operations([{ sum: {}, dimensions: { actionType: 'GetObject' } }]),
		).toEqual({
			classA: null,
			classB: null,
		});
		expect(classifyR2Operations(null)).toEqual({ classA: null, classB: null });
	});
});
