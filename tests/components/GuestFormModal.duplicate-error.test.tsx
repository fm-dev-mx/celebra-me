import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuestFormModal from '@/components/dashboard/guests/GuestFormModal';
import { guestsApi } from '@/lib/dashboard/guests-api';

jest.mock('@/lib/dashboard/guests-api', () => ({
	guestsApi: {
		create: jest.fn(),
		update: jest.fn(),
		listEvents: jest.fn(),
		list: jest.fn(),
		delete: jest.fn(),
		markShared: jest.fn(),
		revertShared: jest.fn(),
		bulkImport: jest.fn(),
		exportCsv: jest.fn(),
	},
}));

jest.mock('@/components/dashboard/DashboardModalPortal', () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedGuestsApi = guestsApi as jest.Mocked<typeof guestsApi>;

describe('GuestFormModal duplicate error UI', () => {
	const onClose = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	function submitWithPhone() {
		fireEvent.change(screen.getByLabelText('Nombre completo'), {
			target: { value: 'Test Guest' },
		});
		fireEvent.change(screen.getByLabelText('Teléfono (WhatsApp)'), {
			target: { value: '6691234567' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
	}

	it('renders phone field error on conflict and does not leak English messages', async () => {
		mockedGuestsApi.create.mockRejectedValue({
			code: 'conflict',
			message: 'Ya existe un invitado con ese número de teléfono.',
			status: 409,
		});

		render(
			<GuestFormModal
				open={true}
				mode="create"
				initialGuest={null}
				onClose={onClose}
				onSubmit={async (payload) => {
					await guestsApi.create(
						payload as unknown as Parameters<typeof guestsApi.create>[0],
					);
				}}
			/>,
		);

		submitWithPhone();

		await waitFor(() => {
			expect(screen.getByText('Este teléfono ya está registrado.')).toBeInTheDocument();
		});

		expect(screen.queryByText('A record with the same data already exists.')).toBeNull();
		expect(
			screen.queryByText('This phone number is already registered for this event.'),
		).toBeNull();
		expect(
			screen.queryByText('A guest with that phone number already exists for this event.'),
		).toBeNull();
	});
});
