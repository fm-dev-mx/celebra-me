import { render, screen, waitFor } from '@testing-library/react';
import GuestDashboardApp from '@/components/dashboard/guests/GuestDashboardApp';

class MockEventSource {
	addEventListener = jest.fn();
	close = jest.fn();
	onerror: (() => void) | null = null;
	constructor(url: string) {
		void url;
	}
}

describe('GuestDashboardApp auth states', () => {
	const originalFetch = global.fetch;
	const originalEventSource = (global as unknown as { EventSource?: unknown }).EventSource;

	beforeEach(() => {
		(global as unknown as { EventSource: unknown }).EventSource = MockEventSource;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		(global as unknown as { EventSource?: unknown }).EventSource = originalEventSource;
		jest.restoreAllMocks();
	});

	it('shows API unauthorized error when dashboard endpoints return 401', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ code: 'unauthorized', message: 'No autorizado.' }),
		}) as typeof fetch;

		render(<GuestDashboardApp initialEventId="" />);

		await waitFor(() => {
			expect(screen.getByText('No autorizado.')).toBeInTheDocument();
		});
	});
});
