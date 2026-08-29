import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValentinaMemoriesRecovery from '@/components/memories/ValentinaMemoriesRecovery';
import { valentinaMemoriesRecoveryPageCopy } from '@/data/valentina-memories.data';
import {
	recoverValentinaMemoriesSession,
	ValentinaMemoriesSessionRequestError,
} from '@/lib/memories/valentina-memories-session-client';

jest.mock('@/lib/memories/valentina-memories-session-client', () => {
	const actual = jest.requireActual('@/lib/memories/valentina-memories-session-client');
	return { ...actual, recoverValentinaMemoriesSession: jest.fn() };
});

const mockRecover = recoverValentinaMemoriesSession as jest.MockedFunction<
	typeof recoverValentinaMemoriesSession
>;

describe('ValentinaMemoriesRecovery', () => {
	beforeEach(() => jest.clearAllMocks());

	it('recovers with a code kept in the request body and hands off to the memories anchor', async () => {
		const user = userEvent.setup();
		const onRecovered = jest.fn();
		mockRecover.mockResolvedValue({
			displayName: 'Tía Ana',
			expiresAt: '2026-09-28T00:00:00.000Z',
		});
		render(<ValentinaMemoriesRecovery onRecovered={onRecovered} />);

		await user.type(
			screen.getByLabelText(valentinaMemoriesRecoveryPageCopy.inputLabel),
			'abcd-2345-efgh',
		);
		await user.click(
			screen.getByRole('button', { name: valentinaMemoriesRecoveryPageCopy.submit }),
		);

		await waitFor(() => expect(onRecovered).toHaveBeenCalledTimes(1));
		expect(mockRecover).toHaveBeenCalledWith('ABCD-2345-EFGH');
		expect(screen.getByLabelText(valentinaMemoriesRecoveryPageCopy.inputLabel)).toHaveValue('');
	});

	it.each([
		['inválido', 401],
		['vencido', 401],
		['revocado', 401],
		['limitado', 429],
	])('uses the same generic message for a code %s', async (_case, status) => {
		const user = userEvent.setup();
		mockRecover.mockRejectedValue(new ValentinaMemoriesSessionRequestError(status));
		render(<ValentinaMemoriesRecovery onRecovered={jest.fn()} />);

		await user.type(
			screen.getByLabelText(valentinaMemoriesRecoveryPageCopy.inputLabel),
			'ABCD-2345-EFGH',
		);
		await user.click(
			screen.getByRole('button', { name: valentinaMemoriesRecoveryPageCopy.submit }),
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			valentinaMemoriesRecoveryPageCopy.failed,
		);
	});
});
