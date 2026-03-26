const assetStub = {
	hero: 'test-file-stub',
	portrait: 'test-file-stub',
	jardin: 'test-file-stub',
	family: 'test-file-stub',
	signature: 'test-file-stub',
	thankYouPortrait: 'test-file-stub',
	interlude01: 'test-file-stub',
	interlude02: 'test-file-stub',
	interlude03: 'test-file-stub',
	interludeNew01: 'test-file-stub',
	gallery: Array(20).fill('test-file-stub'),
};

export const discoverEventModules = jest.fn(() => ({
	'../../assets/images/events/demo-xv/index.ts': assetStub,
	'../../assets/images/events/noir-premiere-xv/index.ts': assetStub,
	'../../assets/images/events/ximena-meza-trasvina/index.ts': assetStub,
}));
