import { act, renderHook } from '@testing-library/react';
import { useIntakeForm } from '@/hooks/use-intake-form';

const fetchMock = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	global.fetch = fetchMock;
});

describe('useIntakeForm admin mode', () => {
	it('saves steps through the stable dashboard endpoint', async () => {
		fetchMock.mockResolvedValue({ ok: true });
		const { result } = renderHook(() =>
			useIntakeForm({
				mode: 'admin',
				invitationId: 'proj-1',
				enabledBlocks: ['event-details'],
				initialBlockData: {
					'event-details': {
						celebrantName: 'Ana',
						eventLabel: 'Mis XV',
						eventDate: '2027-01-01T00:00:00.000Z',
						eventTitle: 'XV Ana',
						description: '',
						nickname: '',
						secondaryName: '',
					},
				},
				initialStatus: 'approved',
				isLocked: false,
			}),
		);

		await act(async () => {
			await result.current.nextStep();
		});

		expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/intake/proj-1/edit', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				blockType: 'event-details',
				blockData: {
					celebrantName: 'Ana',
					eventLabel: 'Mis XV',
					eventDate: '2027-01-01T00:00:00.000Z',
					eventTitle: 'XV Ana',
					description: '',
					nickname: '',
					secondaryName: '',
				},
			}),
		});
	});

	it('uses the admin endpoint to save comments without client submission semantics', async () => {
		fetchMock.mockResolvedValue({ ok: true });
		const { result } = renderHook(() =>
			useIntakeForm({
				mode: 'admin',
				invitationId: 'proj-1',
				enabledBlocks: [],
				initialBlockData: {},
				initialStatus: 'approved',
				isLocked: false,
			}),
		);

		act(() => {
			result.current.setClientComments('Nota interna');
		});
		await act(async () => {
			await result.current.submit();
		});

		expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/intake/proj-1/edit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clientComments: 'Nota interna' }),
		});
		expect(result.current.submitted).toBe(false);
		expect(result.current.saved).toBe(true);
	});
});
