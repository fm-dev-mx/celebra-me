import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('downloadIcsFile', () => {
	let module: typeof import('@/lib/calendar/download-calendar-file');

	function createAnchorMock() {
		let downloadValue = '';
		return {
			href: '',
			get download(): string {
				return downloadValue;
			},
			set download(v: string) {
				downloadValue = v;
			},
			click: jest.fn(),
		};
	}

	beforeEach(async () => {
		const mockUrl = 'blob:mock-url';
		URL.createObjectURL = jest.fn(() => mockUrl) as unknown as typeof URL.createObjectURL;
		URL.revokeObjectURL = jest.fn() as unknown as typeof URL.revokeObjectURL;
		document.createElement = jest.fn(() =>
			createAnchorMock(),
		) as unknown as typeof document.createElement;
		document.body.appendChild = jest.fn() as unknown as typeof document.body.appendChild;
		document.body.removeChild = jest.fn() as unknown as typeof document.body.removeChild;

		jest.isolateModules(() => {});
		module = await import('@/lib/calendar/download-calendar-file');
	});

	it('does not throw when called with valid arguments', () => {
		expect(() => module.downloadIcsFile('test content', 'evento')).not.toThrow();
	});

	it('creates a Blob with the correct MIME type', () => {
		module.downloadIcsFile('test content', 'evento');
		expect(URL.createObjectURL).toHaveBeenCalled();
	});

	it('creates and revokes an object URL', () => {
		const mockUrl = 'blob:custom';
		(URL.createObjectURL as jest.Mock).mockReturnValue(mockUrl);
		(URL.revokeObjectURL as jest.Mock).mockClear();

		const anchor = document.createElement('a') as HTMLAnchorElement;
		const clickFn = jest.fn();
		anchor.click = clickFn;
		(document.createElement as jest.Mock).mockReturnValue(anchor);

		module.downloadIcsFile('test content', 'evento');

		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
		expect((document.body.appendChild as jest.Mock).mock.calls.length).toBe(1);
		expect((document.body.removeChild as jest.Mock).mock.calls.length).toBe(1);
	});

	it('uses a sanitized file name with .ics extension', () => {
		module.downloadIcsFile('content', 'Mi Evento Especial!');

		const anchor = jest.mocked(document.createElement).mock.results[0]
			.value as HTMLAnchorElement;
		expect(anchor.download).toBe('mi-evento-especial-.ics');
	});
});
