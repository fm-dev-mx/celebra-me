import { render, screen, fireEvent } from '@testing-library/react';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

function renderModal(
	eventId = '550e8400-e29b-41d4-a716-446655440000',
	existingGuests: DashboardGuestItem[] = [],
) {
	const onImport = jest.fn().mockResolvedValue({ created: 1, updated: 0, status: 'success' });
	const onUpdate = jest.fn().mockResolvedValue(undefined);
	const onClose = jest.fn();
	render(
		<ImportMagic
			onImport={onImport}
			onUpdate={onUpdate}
			onClose={onClose}
			eventId={eventId}
			existingGuests={existingGuests}
		/>,
	);
	return { onImport, onUpdate, onClose };
}

function importCsv(content: string) {
	const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
	fireEvent.change(textarea, { target: { value: content } });
}

function getImportButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: /importar/i }) as HTMLButtonElement;
}

describe('delete rows', () => {
	beforeEach(async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
	});

	it('deletes a row from preview', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+525551234567,');
		const deleteButtons = document.querySelectorAll('.import-magic__delete-btn');
		expect(deleteButtons.length).toBe(2);
		fireEvent.click(deleteButtons[0]);
		expect(document.querySelectorAll('.import-magic__delete-btn').length).toBe(1);
	});

	it('deleting a row updates import count', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,+525551234567,');
		const deleteButtons = document.querySelectorAll('.import-magic__delete-btn');
		fireEvent.click(deleteButtons[0]);
		expect(getImportButton().disabled).toBe(false);
		expect(getImportButton().textContent).toContain('Importar 1 cambio');
	});

	it('deleting all rows disables import and shows an empty state', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		const deleteButtons = document.querySelectorAll('.import-magic__delete-btn');
		fireEvent.click(deleteButtons[0]);
		expect(getImportButton().disabled).toBe(true);
	});
});

describe('API error handling', () => {
	const TEST_EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

	it('shows retryable error message', async () => {
		const onImport = jest.fn().mockRejectedValue(new Error('Network error'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		expect(await screen.findByText(/No pudimos importar/i)).toBeInTheDocument();
	});

	it('handles row-level error details', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue({ details: { rows: ['Fila 1: error de prueba'] } });
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		expect(await screen.findByText(/error de prueba/i)).toBeInTheDocument();
	});
});

describe('import result summary', () => {
	const TEST_EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

	it('does not imply guests were added when the backend reports only updates', async () => {
		const onImport = jest.fn().mockResolvedValue({
			created: 0,
			updated: 2,
			skipped: 0,
			conflicts: 0,
			status: 'success',
		});
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={jest.fn()}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,6691234567,+52');
		fireEvent.click(getImportButton());

		expect(await screen.findByText('2')).toBeInTheDocument();
		expect(screen.getByText('invitados actualizados')).toBeInTheDocument();
		expect(screen.queryByText(/Todos los invitados se importaron correctamente/i)).toBeNull();
		expect(screen.queryByText(/invitados importados/i)).toBeNull();
	});

	it('shows create conflicts separately in the result summary', async () => {
		const onImport = jest.fn().mockResolvedValue({
			created: 0,
			updated: 0,
			skipped: 0,
			conflicts: 1,
			errors: ['Fila 1: el teléfono ya existe para este evento.'],
			status: 'partial',
		});
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={jest.fn()}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,6691234567,+52');
		fireEvent.click(getImportButton());

		expect(await screen.findByText('conflicto')).toBeInTheDocument();
		expect(screen.getByText(/teléfono ya existe/i)).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Volver a la vista previa/i }),
		).toBeInTheDocument();
	});
});

describe('fatal event/access error', () => {
	const TEST_EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

	it('disables import when fatal event/access error is present', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue(new Error('Event not found or access denied.'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		await screen.findByText(/Los datos son válidos/i);

		expect(getImportButton().disabled).toBe(true);
	});

	it('disables import button and shows fatal error when import fails with access error', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue(new Error('Event not found or access denied.'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(screen.getByText('Crear')).toBeInTheDocument();
		expect(getImportButton()).not.toBeDisabled();
		fireEvent.click(getImportButton());
		await screen.findByText(/Los datos son válidos/i);
		expect(getImportButton().disabled).toBe(true);
	});

	it('shows fatal error message when event/access fails', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue(new Error('Event not found or access denied.'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());

		const fatalEl = await screen.findByText(/Los datos son válidos/i);
		expect(fatalEl).toBeInTheDocument();
		expect(fatalEl.textContent).toContain('no se puede importar');
	});

	it('clears fatal error after new parse', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue(new Error('Event not found or access denied.'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		await screen.findByText(/Los datos son válidos/i);
		importCsv('full_name,phone,country_code\nLuis,+525551234567,');
		expect(screen.queryByText(/Los datos son válidos/i)).toBeNull();
	});

	it('clears fatal error after new CSV selection (re-parse)', async () => {
		const onImport = jest
			.fn()
			.mockRejectedValue(new Error('Event not found or access denied.'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		await screen.findByText(/Los datos son válidos/i);
		const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
		fireEvent.paste(textarea, {
			clipboardData: { getData: () => 'full_name,phone,country_code\nLuis,+525551234567,' },
		});
		expect(screen.queryByText(/Los datos son válidos/i)).toBeNull();
	});
});

describe('retryable error', () => {
	const TEST_EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

	it('unknown retryable error shows Spanish fallback and allows retry', async () => {
		const onImport = jest.fn().mockRejectedValue(new Error('Network error'));
		const onClose = jest.fn();
		render(
			<ImportMagic
				onImport={onImport}
				onUpdate={jest.fn()}
				onClose={onClose}
				eventId={TEST_EVENT_ID}
				existingGuests={[]}
			/>,
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		fireEvent.click(getImportButton());
		const fallbackEl = await screen.findByText(/No pudimos importar/i);
		expect(fallbackEl).toBeInTheDocument();
		expect(getImportButton().disabled).toBe(false);
	});
});

describe('event id context', () => {
	it('disables import when eventId is empty', async () => {
		renderModal('');
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(getImportButton().disabled).toBe(true);
	});
});

describe('source textarea collapse', () => {
	it('collapses textarea after paste', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
		fireEvent.paste(textarea, {
			clipboardData: { getData: () => 'full_name,phone,country_code\nAna,+526691234567,' },
		});

		expect(textarea.rows).toBe(2);
	});

	it('shows edit button after collapse', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
		fireEvent.paste(textarea, {
			clipboardData: { getData: () => 'full_name,phone,country_code\nAna,+526691234567,' },
		});

		expect(screen.getByText(/Editar datos pegados/i)).toBeInTheDocument();
	});

	it('re-expands textarea when edit button is clicked', async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);

		const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
		fireEvent.paste(textarea, {
			clipboardData: { getData: () => 'full_name,phone,country_code\nAna,+526691234567,' },
		});

		fireEvent.click(screen.getByText(/Editar datos pegados/i));
		expect(textarea.rows).toBe(4);
	});
});

describe('summary chips and button states', () => {
	beforeEach(async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
	});

	it('renders Crear chip for valid new rows', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(screen.getByText('Crear')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
	});

	it('shows enabled primary button with import count when actionable rows exist', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		const btn = getImportButton();
		expect(btn.disabled).toBe(false);
		expect(btn.textContent).toContain('Importar 1 cambio');
	});

	it('shows hidden hint when review rows are hidden', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		// No review rows → no hint
		expect(screen.queryByText(/ocultos?/i)).toBeNull();
	});

	it('shows neutral disabled button with error message when only error rows exist', () => {
		importCsv('full_name,phone,country_code\n,6691234567,');
		const btn = getImportButton();
		expect(btn.disabled).toBe(true);
		expect(btn.textContent).toBe('No se puede importar');
	});
});

describe('all duplicates', () => {
	it('shows neutral disabled button when all rows are exact duplicates', () => {
		const existing: DashboardGuestItem[] = [
			{
				guestId: 'dup-1',
				inviteId: 'inv-1',
				fullName: 'Ana',
				phone: '+526691234567',
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
			},
		];
		renderModal('550e8400-e29b-41d4-a716-446655440000', existing);
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		const btn = getImportButton();
		expect(btn.disabled).toBe(true);
		expect(btn.textContent).toBe('No hay cambios para importar');
	});

	it('shows hidden review hint when rows are hidden possible duplicates', () => {
		const existing: DashboardGuestItem[] = [
			{
				guestId: 'ex-1',
				inviteId: 'inv-1',
				fullName: 'Ana López',
				phone: '+526691234567',
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
			},
		];
		renderModal('550e8400-e29b-41d4-a716-446655440000', existing);
		importCsv('full_name,phone\nAna López,\nLuis,+525551234567,');
		expect(screen.getByText(/duplicado oculto/i)).toBeInTheDocument();
	});
});
