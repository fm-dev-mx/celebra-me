export const glob = jest.fn((_config: any) => ({
	name: 'mock-glob-loader',
	load: jest.fn(),
}));

export const file = jest.fn((_config: any) => ({
	name: 'mock-file-loader',
	load: jest.fn(),
}));
