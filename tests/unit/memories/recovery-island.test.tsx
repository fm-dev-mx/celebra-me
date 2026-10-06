import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesRecovery from '@/components/memories/MemoriesRecovery';
import {
	MemoriesRequestError,
	createMemoriesGuestApi,
	type MemoriesGuestApi,
} from '@/lib/memories/client/api';
import { memoriesRecoveryFormCopy as copy } from '@/lib/memories/copy';

jest.mock('@/lib/memories/client/api', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/api')>(
		'@/lib/memories/client/api',
	);
	return { ...actual, createMemoriesGuestApi: jest.fn() };
});

const PUBLIC_SLUG = 'victoria-y-roberto';

const mockedCreateGuestApi = createMemoriesGuestApi as jest.MockedFunction<
	typeof createMemoriesGuestApi
>;

function createGuestApiFake(): jest.Mocked<MemoriesGuestApi> {
	const itemsUrl = `/api/memories/${PUBLIC_SLUG}/items`;
	const fake = {
		itemsUrl,
		itemMediaUrl: jest.fn((itemId: string) => `${itemsUrl}/${encodeURIComponent(itemId)}`),
		getSession: jest.fn(),
		createSession: jest.fn(),
		recoverSession: jest.fn(),
		updateProfile: jest.fn(),
		listItems: jest.fn(),
		reserve: jest.fn(),
		complete: jest.fn(),
		updateCaption: jest.fn(),
		deleteItem: jest.fn(),
	};
	return fake as unknown as jest.Mocked<MemoriesGuestApi>;
}

describe('MemoriesRecovery island', () => {
	let guestApi: jest.Mocked<MemoriesGuestApi>;

	beforeEach(() => {
		guestApi = createGuestApiFake();
		mockedCreateGuestApi.mockReset();
		mockedCreateGuestApi.mockReturnValue(guestApi);
	});

	it('uppercases the code, recovers with the trimmed value and notifies the caller', async () => {
		const user = userEvent.setup();
		const onRecovered = jest.fn();
		guestApi.recoverSession.mockResolvedValue({
			displayName: 'Tía Ana',
			expiresAt: '2027-01-30T06:00:00.000Z',
		});

		render(<MemoriesRecovery publicSlug={PUBLIC_SLUG} onRecovered={onRecovered} />);

		expect(mockedCreateGuestApi).toHaveBeenCalledWith(PUBLIC_SLUG);
		const input = screen.getByLabelText(copy.inputLabel);
		expect(screen.getByRole('button', { name: copy.submit })).toBeDisabled();

		await user.type(input, 'abcd-2345-efgh');
		expect(input).toHaveValue('ABCD-2345-EFGH');

		// Pasted codes lose spaces and get their hyphens back.
		fireEvent.change(input, { target: { value: ' abcd 2345efgh ' } });
		expect(input).toHaveValue('ABCD-2345-EFGH');

		await user.click(screen.getByRole('button', { name: copy.submit }));

		await waitFor(() => expect(onRecovered).toHaveBeenCalledTimes(1));
		expect(guestApi.recoverSession).toHaveBeenCalledTimes(1);
		expect(guestApi.recoverSession).toHaveBeenCalledWith('ABCD-2345-EFGH');
		expect(input).toHaveValue('');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it.each([
		['unauthorized', 401],
		['rate limited', 429],
		['unavailable', 503],
	])('shows the generic failure copy when recovery is %s (%i)', async (_label, status) => {
		const user = userEvent.setup();
		const onRecovered = jest.fn();
		guestApi.recoverSession.mockRejectedValue(new MemoriesRequestError(status));

		render(<MemoriesRecovery publicSlug={PUBLIC_SLUG} onRecovered={onRecovered} />);

		await user.type(screen.getByLabelText(copy.inputLabel), 'ABCD-2345-EFGH');
		await user.click(screen.getByRole('button', { name: copy.submit }));

		expect(await screen.findByRole('alert')).toHaveTextContent(copy.failed);
		expect(onRecovered).not.toHaveBeenCalled();
		expect(screen.getByLabelText(copy.inputLabel)).toHaveValue('ABCD-2345-EFGH');
		expect(screen.getByRole('button', { name: copy.submit })).toBeEnabled();
	});

	it('clears the failure once the guest edits the code again', async () => {
		const user = userEvent.setup();
		guestApi.recoverSession.mockRejectedValue(new MemoriesRequestError(401));

		render(<MemoriesRecovery publicSlug={PUBLIC_SLUG} onRecovered={jest.fn()} />);

		await user.type(screen.getByLabelText(copy.inputLabel), 'ABCD-2345-EFG');
		await user.click(screen.getByRole('button', { name: copy.submit }));
		expect(await screen.findByRole('alert')).toBeInTheDocument();

		await user.type(screen.getByLabelText(copy.inputLabel), 'H');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
