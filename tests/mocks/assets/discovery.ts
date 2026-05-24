const assetStub = {
	hero: 'test-file-stub',
	portrait: 'test-file-stub',
	jardin: 'test-file-stub',
	family: 'test-file-stub',
	signature: 'test-file-stub',
	ceremony: 'test-file-stub',
	reception: 'test-file-stub',
	rsvp: 'test-file-stub',
	thankYouPortrait: 'test-file-stub',
	interlude01: 'test-file-stub',
	interlude02: 'test-file-stub',
	interlude03: 'test-file-stub',
	interlude04: 'test-file-stub',
	gallery: Array(20).fill('test-file-stub'),
};

export const discoverEventModules = jest.fn(() => ({
	'../../assets/images/events/demo-xv-jewelry-box/index.ts': assetStub,
	'../../assets/images/events/demo-xv-editorial/index.ts': assetStub,
	'../../assets/images/events/demo-bautismo-angelic-presence/index.ts': assetStub,
	'../../assets/images/events/ximena-meza-trasvina/index.ts': assetStub,
	'../../assets/images/events/ana-sofia-cota-guillen/index.ts': assetStub,
	'../../assets/images/events/cesar-ramses/index.ts': assetStub,
	'../../assets/images/events/gerardo-sesenta/index.ts': assetStub,
}));
