export const glob = jest.fn(() => ({
	name: 'mock-glob-loader',
	load: jest.fn(),
}));

export const file = jest.fn(() => ({
	name: 'mock-file-loader',
	load: jest.fn(),
}));
