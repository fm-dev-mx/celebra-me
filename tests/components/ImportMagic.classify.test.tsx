import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import { classifyGuests } from '@/components/dashboard/guests/ImportMagic.utils';
import type { ParsedGuest } from '@/components/dashboard/guests/ImportMagic.utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

const BASE_GUEST_ITEM: DashboardGuestItem = {
	guestId: '',
	inviteId: '',
	fullName: '',
	phone: '',
	phoneCountryCode: '',
	email: null,
	tags: [],
	metadata: {},
	maxAllowedAttendees: 2,
	attendanceStatus: 'pending',
	attendeeCount: 0,
	guestComment: '',
	deliveryStatus: 'generated',
	viewPercentage: 0,
	isViewed: false,
	firstViewedAt: null,
	respondedAt: null,
	waShareUrl: '',
	shareText: '',
	updatedAt: new Date().toISOString(),
};

function makeGuest(overrides: Partial<DashboardGuestItem>): DashboardGuestItem {
	return { ...BASE_GUEST_ITEM, ...overrides };
}

function renderModal(
	eventId = '550e8400-e29b-41d4-a716-446655440000',
	existingGuests: DashboardGuestItem[] = [],
) {
	const onImport = jest.fn().mockResolvedValue(undefined);
	const onClose = jest.fn();
	render(
		<ImportMagic
			onImport={onImport}
			onClose={onClose}
			eventId={eventId}
			existingGuests={existingGuests}
		/>,
	);
	return { onImport, onClose };
}

function importCsv(content: string) {
	const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
	fireEvent.change(textarea, { target: { value: content } });
}

function getImportButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: /importar/i }) as HTMLButtonElement;
}

describe('classifyGuests', () => {
	const mkGuest = (overrides: Partial<ParsedGuest> = {}): ParsedGuest => ({
		fullName: 'Test',
		phone: '',
		phoneCountryCode: '',
		email: null,
		...overrides,
	});

	it('marks a valid guest as new when phone is not in existing set', () => {
		const result = classifyGuests([mkGuest({ phone: '+526691234567' })], new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[0].error).toBeUndefined();
	});

	it('marks guest with existing phone as existing', () => {
		const guests = [mkGuest({ phone: '+526691234567' })];
		const existingPhones = new Set(['526691234567']);
		const result = classifyGuests(guests, existingPhones, new Set());
		expect(result[0]._status).toBe('existing-phone');
	});

	it('marks second occurrence of same phone as duplicate', () => {
		const guests = [
			mkGuest({ fullName: 'First', phone: '+526691234567' }),
			mkGuest({ fullName: 'Second', phone: '+526691234567' }),
		];
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('duplicate-phone');
	});

	it('keeps error rows as new regardless of existing phones', () => {
		const guests = [mkGuest({ phone: '+526691234567', error: 'Some error' })];
		const existingPhones = new Set(['526691234567']);
		const result = classifyGuests(guests, existingPhones, new Set());
		expect(result[0]._status).toBe('new');
		expect(result[0].error).toBe('Some error');
	});

	it('does not match guest without phone to existing set', () => {
		const guests = [mkGuest()]; // no phone
		const existingPhones = new Set(['']); // normalizePhone('') returns ''
		const result = classifyGuests(guests, existingPhones, new Set());
		expect(result[0]._status).toBe('new');
	});

	it('marks second occurrence of identical name (even with different phone) as duplicate-name', () => {
		const guests = [
			mkGuest({ fullName: 'Juan', phone: '+526691234567' }),
			mkGuest({ fullName: 'Juan', phone: '+525551234567' }),
		];
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('duplicate-name');
	});

	it('allows guest without phone even when other guests have phone', () => {
		const guests = [
			mkGuest({ fullName: 'Con Teléfono', phone: '+526691234567' }),
			mkGuest({ fullName: 'Sin Teléfono' }), // no phone
		];
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('new');
	});

	it('handles mixed: new, existing, duplicate, error', () => {
		const guests = [
			mkGuest({ fullName: 'Nuevo', phone: '+521111111111' }),
			mkGuest({ fullName: 'Existente', phone: '+526691234567' }),
			mkGuest({ fullName: 'Duplicado', phone: '+521111111111' }),
			mkGuest({
				fullName: 'Error',
				phone: '6691234567',
				error: 'Agrega el código de país o escribe el número completo empezando con +.',
			}),
		];
		const existingPhones = new Set(['526691234567']);
		const result = classifyGuests(guests, existingPhones, new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('existing-phone');
		expect(result[2]._status).toBe('duplicate-phone');
		expect(result[3]._status).toBe('new');
		expect(result[3].error).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Name-based classification tests
	// -----------------------------------------------------------------------

	it('marks guest with existing name as existing-name', () => {
		const guests = [mkGuest({ fullName: 'María López', phone: '+526691234567' })];
		const existingNames = new Set(['maria lopez']);
		const result = classifyGuests(guests, new Set(), existingNames);
		expect(result[0]._status).toBe('existing-name');
	});

	it('marks second occurrence of same normalized name as duplicate-name', () => {
		const guests = [mkGuest({ fullName: 'Ana López' }), mkGuest({ fullName: 'ana lópez' })];
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('duplicate-name');
	});

	it('normalizes name: accents, casing, and spaces all collapse to match', () => {
		const guests = [mkGuest({ fullName: '  María   López  ' })];
		const existingNames = new Set(['maria lopez']);
		const result = classifyGuests(guests, new Set(), existingNames);
		expect(result[0]._status).toBe('existing-name');
	});

	it('existing phone takes priority over existing name', () => {
		const guests = [mkGuest({ fullName: 'Juan Pérez', phone: '+526691234567' })];
		const existingPhones = new Set(['526691234567']);
		const existingNames = new Set(['juan perez']);
		const result = classifyGuests(guests, existingPhones, existingNames);
		expect(result[0]._status).toBe('existing-phone');
	});

	it('duplicate phone in CSV takes priority over duplicate name', () => {
		const guests = [
			mkGuest({ fullName: 'Ana', phone: '+526691234567' }),
			mkGuest({ fullName: 'Ana', phone: '+526691234567' }),
		];
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('duplicate-phone');
	});

	it('guest without phone but existing name is omitted', () => {
		const guests = [mkGuest({ fullName: 'María López' })]; // no phone
		const existingNames = new Set(['maria lopez']);
		const result = classifyGuests(guests, new Set(), existingNames);
		expect(result[0]._status).toBe('existing-name');
	});

	it('unique guest without phone remains importable', () => {
		const guests = [mkGuest({ fullName: 'Ana Nuevo' })]; // no phone, unique name
		const result = classifyGuests(guests, new Set(), new Set());
		expect(result[0]._status).toBe('new');
	});

	it('empty normalized name does not match existing set', () => {
		const guests = [mkGuest({ fullName: '' })];
		const existingNames = new Set(['']);
		const result = classifyGuests(guests, new Set(), existingNames);
		expect(result[0]._status).toBe('new');
	});
});

describe('existing guest classification', () => {
	const mockExistingPhone = () => [
		makeGuest({
			guestId: 'ex-1',
			inviteId: 'inv-1',
			fullName: 'Existing Guest',
			phone: '+526691234567',
			phoneCountryCode: '+52',
		}),
	];

	it('excludes existing guest from preview table', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', mockExistingPhone());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(await screen.findByText('1 ya estaban agregados por teléfono')).toBeInTheDocument();
		expect(screen.queryByDisplayValue('Ana')).toBeNull();
	});

	it('shows existing count in summary', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', mockExistingPhone());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+525551234567,');
		expect(screen.getByText('1 ya estaban agregados por teléfono')).toBeInTheDocument();
		expect(screen.getByText('1 invitados nuevos')).toBeInTheDocument();
	});

	it('imports only new guests when some are existing', async () => {
		const { onImport } = renderModal(
			'550e8400-e29b-41d4-a716-446655440000',
			mockExistingPhone(),
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+525551234567,');
		fireEvent.click(getImportButton());

		await screen.findByText(/Importar 1 invitado nuevo/i);
		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ fullName: 'Luis' })]),
		);
	});

	it('disables import when all rows are existing', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', mockExistingPhone());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(getImportButton().disabled).toBe(true);
	});
});

describe('duplicate phone within CSV', () => {
	it('shows duplicate count and excludes duplicate from preview', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+526691234567,');
		expect(screen.getByDisplayValue('Ana')).toBeInTheDocument();
		expect(screen.getByText('1 duplicados en el archivo')).toBeInTheDocument();
		expect(screen.queryByDisplayValue('Luis')).toBeNull();
	});

	it('imports only unique phones', async () => {
		const { onImport } = renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+526691234567,');
		fireEvent.click(getImportButton());

		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ fullName: 'Ana' })]),
		);
		expect(onImport).toHaveBeenCalledWith(
			expect.not.arrayContaining([expect.objectContaining({ fullName: 'Luis' })]),
		);
		await waitFor(() => {
			expect(screen.queryByText('Procesando...')).toBeNull();
		});
	});
});

describe('name duplicate classification', () => {
	function mockExistingName() {
		return [
			makeGuest({
				guestId: 'ex-1',
				inviteId: 'inv-1',
				fullName: 'Ana López',
				phone: '+526691234567',
				phoneCountryCode: '+52',
			}),
		];
	}

	it('excludes existing name guest from preview and shows count', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', mockExistingName());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nana lópez,+525551234567,');
		await waitFor(() => {
			expect(screen.getByText('1 posibles duplicados por nombre')).toBeInTheDocument();
		});
		expect(screen.queryByDisplayValue('ana lópez')).toBeNull();
	});

	it('duplicate name in CSV counts both and shows review section', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv(
			'full_name,phone,country_code\nAna López,+526691234567,\nana lópez,+525551234567,',
		);
		expect(screen.getByDisplayValue('Ana López')).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.getByText('1 posibles duplicados por nombre')).toBeInTheDocument();
		});
	});

	it('imports only new guests, excluding name duplicates', async () => {
		const { onImport } = renderModal(
			'550e8400-e29b-41d4-a716-446655440000',
			mockExistingName(),
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv(
			'full_name,phone,country_code\nana lópez,+525551234567,\nPedro Pérez,+525552222222,',
		);
		fireEvent.click(getImportButton());

		await waitFor(() => {
			expect(onImport).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ fullName: 'Pedro Pérez' })]),
			);
		});
		expect(onImport).toHaveBeenCalledWith(
			expect.not.arrayContaining([expect.objectContaining({ fullName: 'ana lópez' })]),
		);
		await waitFor(() => {
			expect(screen.queryByText('Procesando...')).toBeNull();
		});
	});

	it('button count matches importable guest count', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv(
			'full_name,phone,country_code\nAna Nuevo,+526691234567,\nJuan Nuevo,+525551234567,',
		);
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /importar 2 invitados nuevos/i }),
			).toBeInTheDocument();
		});
	});

	it('review UI shows possible name duplicates', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv(
			'full_name,phone,country_code\nAna López,+526691234567,\nana lópez,+525551234567,',
		);
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /posibles duplicados por nombre/i }),
			).toBeInTheDocument();
		});
	});
});
