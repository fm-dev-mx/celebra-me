import { render, screen, fireEvent, within } from '@testing-library/react';
import ImportMagic, {
	splitLine,
	detectHeaders,
	parseLine,
	isHeaderRow,
} from '@/components/dashboard/guests/ImportMagic';
import {
	validateGuestRow,
	KNOWN_IMPORT_HEADERS as KNOWN_HEADERS,
} from '@/components/dashboard/guests/ImportMagic.utils';
import type { ParsedGuest } from '@/components/dashboard/guests/ImportMagic.utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

// ---------------------------------------------------------------------------
// Pure utility tests (preserved and extended)
// ---------------------------------------------------------------------------

describe('splitLine', () => {
	it('splits by tab', () => {
		expect(splitLine('nombre\ttelefono\tpaises')).toEqual(['nombre', 'telefono', 'paises']);
	});

	it('splits by comma', () => {
		expect(splitLine('nombre,telefono,paises')).toEqual(['nombre', 'telefono', 'paises']);
	});

	it('splits by semicolon', () => {
		expect(splitLine('nombre;telefono;paises')).toEqual(['nombre', 'telefono', 'paises']);
	});

	it('returns single-element array when no delimiter matches', () => {
		expect(splitLine('justonestring')).toEqual(['justonestring']);
	});

	it('prefers tab over comma when both present', () => {
		expect(splitLine('a\tb,c')).toEqual(['a', 'b,c']);
	});

	it('handles empty string', () => {
		expect(splitLine('')).toEqual(['']);
	});
});

describe('KNOWN_HEADERS', () => {
	it('includes full_name', () => {
		expect(KNOWN_HEADERS['full_name']).toBe('fullName');
	});

	it('includes nombre', () => {
		expect(KNOWN_HEADERS['nombre']).toBe('fullName');
	});

	it('includes name', () => {
		expect(KNOWN_HEADERS['name']).toBe('fullName');
	});

	it('includes phone', () => {
		expect(KNOWN_HEADERS['phone']).toBe('phone');
	});

	it('includes telefono', () => {
		expect(KNOWN_HEADERS['telefono']).toBe('phone');
	});

	it('includes teléfono', () => {
		expect(KNOWN_HEADERS['teléfono']).toBe('phone');
	});

	it('includes country_code', () => {
		expect(KNOWN_HEADERS['country_code']).toBe('phoneCountryCode');
	});

	it('includes clave_pais', () => {
		expect(KNOWN_HEADERS['clave_pais']).toBe('phoneCountryCode');
	});

	it('includes email', () => {
		expect(KNOWN_HEADERS['email']).toBe('email');
	});

	it('includes correo', () => {
		expect(KNOWN_HEADERS['correo']).toBe('email');
	});
});

describe('detectHeaders', () => {
	describe('exported CSV format (comma-separated)', () => {
		const exportHeader =
			'full_name,phone,country_code,attendance_status,attendee_count,max_allowed_attendees,delivery_status,tags,guest_comment';

		it('recognizes exported CSV headers', () => {
			const mapping = detectHeaders(exportHeader);
			expect(mapping).not.toBeNull();
			expect(mapping!.get('0')).toBe('fullName');
			expect(mapping!.get('1')).toBe('phone');
			expect(mapping!.get('2')).toBe('phoneCountryCode');
		});

		it('does not map extra columns', () => {
			const mapping = detectHeaders(exportHeader);
			expect(mapping!.get('3')).toBeUndefined();
			expect(mapping!.get('4')).toBeUndefined();
			expect(mapping!.get('5')).toBe('maxAllowedAttendees');
			expect(mapping!.get('6')).toBeUndefined();
			expect(mapping!.get('7')).toBe('tags');
			expect(mapping!.get('8')).toBeUndefined();
		});
	});

	describe('Spanish headers (tab-separated)', () => {
		it('recognises nombre, telefono, clave_pais', () => {
			const mapping = detectHeaders('nombre\ttelefono\tclave_pais');
			expect(mapping).not.toBeNull();
			expect(mapping!.get('0')).toBe('fullName');
			expect(mapping!.get('1')).toBe('phone');
			expect(mapping!.get('2')).toBe('phoneCountryCode');
		});
	});

	describe('English headers (tab-separated)', () => {
		it('recognises name, phone, country_code, email', () => {
			const mapping = detectHeaders('name\tphone\tcountry_code\temail');
			expect(mapping).not.toBeNull();
			expect(mapping!.get('0')).toBe('fullName');
			expect(mapping!.get('1')).toBe('phone');
			expect(mapping!.get('2')).toBe('phoneCountryCode');
			expect(mapping!.get('3')).toBe('email');
		});
	});

	describe('semicolon-separated', () => {
		it('recognises headers with semicolons', () => {
			const mapping = detectHeaders('nombre;telefono;clave_pais');
			expect(mapping).not.toBeNull();
			expect(mapping!.get('0')).toBe('fullName');
			expect(mapping!.get('1')).toBe('phone');
			expect(mapping!.get('2')).toBe('phoneCountryCode');
		});
	});

	it('returns null when fewer than 2 known columns', () => {
		expect(detectHeaders('nombre')).toBeNull();
		expect(detectHeaders('foo,bar,baz')).toBeNull();
	});

	it('is case-insensitive', () => {
		const mapping = detectHeaders('Full_Name,Phone,Country_Code');
		expect(mapping).not.toBeNull();
		expect(mapping!.get('0')).toBe('fullName');
		expect(mapping!.get('1')).toBe('phone');
		expect(mapping!.get('2')).toBe('phoneCountryCode');
	});
});

describe('isHeaderRow', () => {
	it('returns true when a cell matches a known header', () => {
		expect(isHeaderRow(['nombre', 'foo'])).toBe(true);
		expect(isHeaderRow(['phone', 'bar'])).toBe(true);
	});

	it('returns true when no cells look like data values', () => {
		expect(isHeaderRow(['Cliente', 'Celular', 'Lada'])).toBe(true);
		expect(isHeaderRow(['foo', 'bar', 'baz'])).toBe(true);
	});

	it('returns false when a cell looks like a phone number', () => {
		expect(isHeaderRow(['tist', '6563769461'])).toBe(false);
	});

	it('returns false when a cell starts with +', () => {
		expect(isHeaderRow(['foo', '+526691234567'])).toBe(false);
	});

	it('returns false when a cell contains @', () => {
		expect(isHeaderRow(['foo', 'bar@test.com'])).toBe(false);
	});
});

describe('parseLine with column mapping', () => {
	const exportMapping = detectHeaders(
		'full_name,phone,country_code,attendance_status,attendee_count,max_allowed_attendees,delivery_status,tags,guest_comment',
	)!;

	it('parses exported CSV row correctly', () => {
		const result = parseLine(
			['Ana López', '6691234567', '+52', 'confirmed', '2', '2', 'shared', '', ''],
			exportMapping,
		);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('6691234567');
		expect(result.phoneCountryCode).toBe('+52');
	});

	it('ignores extra exported columns', () => {
		const result = parseLine(
			[
				'Ana López',
				'6691234567',
				'+52',
				'confirmed',
				'2',
				'2',
				'shared',
				'Amigos',
				'Todo bien',
			],
			exportMapping,
		);
		expect(result.fullName).toBe('Ana López');
		expect(result.email).toBeNull();
	});

	it('parses guest without phone', () => {
		const result = parseLine(
			['Invitado Sin Teléfono', '', '', '', '0', '2', 'generated', '', ''],
			exportMapping,
		);
		expect(result.fullName).toBe('Invitado Sin Teléfono');
		expect(result.phone).toBe('');
		expect(result.phoneCountryCode).toBe('');
		expect(result.error).toBeUndefined();
	});

	it('validates local phone without country code', () => {
		const result = parseLine(
			['Ana López', '6691234567', '', 'pending', '0', '2', 'generated', '', ''],
			exportMapping,
		);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('6691234567');
		expect(result.error).toContain('código de país');
	});

	it('accepts international phone without country code', () => {
		const result = parseLine(
			['Carlos', '+526691234567', '', 'pending', '0', '2', 'generated', '', ''],
			exportMapping,
		);
		expect(result.fullName).toBe('Carlos');
		expect(result.phone).toBe('+526691234567');
		expect(result.phoneCountryCode).toBe('');
		expect(result.error).toBeUndefined();
	});

	it('accepts international phone with matching country code', () => {
		const result = parseLine(
			['Carlos', '+526691234567', '+52', 'pending', '0', '2', 'generated', '', ''],
			exportMapping,
		);
		expect(result.error).toBeUndefined();
	});
});

describe('parseLine without column mapping (positional fallback)', () => {
	it('parses 4-column data [name, phone, country_code, email]', () => {
		const result = parseLine(['Ana López', '6691234567', '+52', 'ana@test.com'], null);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('6691234567');
		expect(result.phoneCountryCode).toBe('+52');
		expect(result.email).toBe('ana@test.com');
	});

	it('parses 3-column legacy data [name, phone, email]', () => {
		const result = parseLine(['Ana López', '6691234567', 'ana@test.com'], null);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('6691234567');
		expect(result.phoneCountryCode).toBe('');
		expect(result.email).toBe('ana@test.com');
	});

	it('parses 3-column data [name, phone, country_code] when third starts with +', () => {
		const result = parseLine(['Ana López', '6691234567', '+52'], null);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('6691234567');
		expect(result.phoneCountryCode).toBe('+52');
		expect(result.email).toBeNull();
	});

	it('parses 2-column data [name, phone]', () => {
		const result = parseLine(['Ana López', '+526691234567'], null);
		expect(result.fullName).toBe('Ana López');
		expect(result.phone).toBe('+526691234567');
		expect(result.phoneCountryCode).toBe('');
	});

	it('validates local phone without country code', () => {
		const result = parseLine(['Ana López', '6691234567'], null);
		expect(result.error).toContain('código de país');
	});
});

describe('round-trip scenario', () => {
	const testCases = [
		{
			name: 'Mexican phone',
			original: '+526691234567',
			exportPhone: '6691234567',
			exportCc: '+52',
		},
		{
			name: 'US phone',
			original: '+15551234567',
			exportPhone: '5551234567',
			exportCc: '+1',
		},
		{
			name: 'Spanish phone',
			original: '+34612345678',
			exportPhone: '612345678',
			exportCc: '+34',
		},
	];

	const exportMapping = detectHeaders('full_name,phone,country_code')!;

	for (const tc of testCases) {
		it(`round-trips ${tc.name}`, () => {
			const parsed = parseLine(['Test', tc.exportPhone, tc.exportCc], exportMapping);
			expect(parsed.phone).toBe(tc.exportPhone);
			expect(parsed.phoneCountryCode).toBe(tc.exportCc);
		});
	}

	it('round-trips guest without phone', () => {
		const parsed = parseLine(['Sin Teléfono', '', ''], exportMapping);
		expect(parsed.fullName).toBe('Sin Teléfono');
		expect(parsed.phone).toBe('');
		expect(parsed.phoneCountryCode).toBe('');
		expect(parsed.error).toBeUndefined();
	});
});

describe('validateGuestRow', () => {
	it('empty phone + empty country code is valid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '',
			phoneCountryCode: '',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toBeUndefined();
		expect(result.fieldErrors).toBeUndefined();
	});

	it('local phone + empty country code is invalid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '6691234567',
			phoneCountryCode: '',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toContain('código de país');
		expect(result.fieldErrors?.phone).toBeDefined();
		expect(result.fieldErrors?.phoneCountryCode).toBeDefined();
	});

	it('phone starting with + + empty country code is valid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '+526691234567',
			phoneCountryCode: '',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toBeUndefined();
		expect(result.fieldErrors).toBeUndefined();
	});

	it('phone starting with + + matching country code is valid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '+526691234567',
			phoneCountryCode: '+52',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toBeUndefined();
	});

	it('local phone + country code is valid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '6691234567',
			phoneCountryCode: '+52',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toBeUndefined();
	});

	it('phone starting with + + conflicting country code is invalid', () => {
		const guest: ParsedGuest = {
			fullName: 'Ana',
			phone: '+526691234567',
			phoneCountryCode: '+1',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toBeDefined();
		expect(result.fieldErrors?.phone).toContain('no coincide');
	});

	it('required name is enforced', () => {
		const guest: ParsedGuest = {
			fullName: '',
			phone: '',
			phoneCountryCode: '',
			email: null,
		};
		const result = validateGuestRow(guest);
		expect(result.rowError).toContain('El nombre es obligatorio');
		expect(result.fieldErrors?.fullName).toBeDefined();
	});
});

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

function getConfirmMappingButton(): HTMLButtonElement | null {
	const buttons = screen.queryAllByRole('button');
	return (
		(buttons.find((b) => b.textContent === 'Confirmar asignación') as HTMLButtonElement) || null
	);
}

describe('column mapping', () => {
	beforeEach(async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
	});

	it('known export headers do not trigger manual mapping', () => {
		importCsv('full_name,phone,country_code\nAna,6691234567,+52');
		expect(screen.queryByText(/No pudimos identificar/i)).toBeNull();
		expect(getImportButton()).not.toBeNull();
	});

	it('unknown headers trigger the mapping UI', () => {
		importCsv('foo,bar,baz\nAna,6691234567,+52');
		expect(screen.getByText(/No pudimos identificar/i)).toBeInTheDocument();
	});

	it('nombre only is treated as header, mapping UI shown', () => {
		importCsv('nombre\nAna');
		expect(screen.getByText(/No pudimos identificar/i)).toBeInTheDocument();
	});

	it('phone only is treated as header, mapping UI shown', () => {
		importCsv('phone\n6691234567');
		expect(screen.getByText(/No pudimos identificar/i)).toBeInTheDocument();
	});

	it('custom headers like Cliente,Celular,Lada trigger mapping UI', () => {
		importCsv('Cliente,Celular,Lada\nAna,6691234567,52');
		expect(screen.getByText(/No pudimos identificar/i)).toBeInTheDocument();
	});

	it('headerless data (tist,6563769461) preserves first row as guest data', () => {
		importCsv('tist,6563769461');
		expect(screen.getByText(/No pudimos identificar/i)).toBeInTheDocument();
		const selects = screen.getAllByRole('combobox');
		// Generic labels
		expect(selects.length).toBe(2);
		// Map Columna 1 to Nombre, keep Columna 2 as ignore
		fireEvent.change(selects[0], { target: { value: 'fullName' } });
		const confirmBtn = getConfirmMappingButton();
		fireEvent.click(confirmBtn!);
		expect(screen.getByDisplayValue('tist')).toBeInTheDocument();
	});

	it('mapping a source column to Nombre allows preview to continue', () => {
		importCsv('foo,bar\nJuan,6691234567');
		const selects = screen.getAllByRole('combobox');
		fireEvent.change(selects[0], { target: { value: 'fullName' } });
		const confirmBtn = getConfirmMappingButton();
		expect(confirmBtn).not.toBeNull();
		expect(confirmBtn!.disabled).toBe(false);
		fireEvent.click(confirmBtn!);
		expect(screen.getByText(/Juan/i)).toBeInTheDocument();
	});

	it('missing Nombre mapping blocks confirm', () => {
		importCsv('foo,bar\nJuan,6691234567');
		const confirmBtn = getConfirmMappingButton();
		expect(confirmBtn).not.toBeNull();
		expect(confirmBtn!.disabled).toBe(true);
	});

	it('duplicate target mappings are prevented (except Ignorar)', () => {
		importCsv('a,b,c\n1,2,3');
		const selects = screen.getAllByRole('combobox');
		fireEvent.change(selects[0], { target: { value: 'fullName' } });
		const optionsCol2 = within(selects[1]).getAllByRole('option');
		const nombreOption = optionsCol2.find((o) => o.textContent === 'Nombre');
		expect((nombreOption as HTMLOptionElement).disabled).toBe(true);
	});

	it('changing mapping rebuilds preview and recalculates errors', () => {
		importCsv('name,phone\nAna,6691234567');
		expect(screen.queryByText(/No pudimos identificar/i)).toBeNull();
		// Error row appears in editable table with cell-level error message
		expect(screen.getByText(/código de país/i)).toBeInTheDocument();
	});
});

describe('editable preview', () => {
	beforeEach(async () => {
		renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
	});

	it('error row appears in editable table with status badge and cell-level error', () => {
		importCsv('full_name,phone,country_code\nAna,6691234567,');
		expect(screen.getByText(/código de país/i)).toBeInTheDocument();
		expect(screen.getByText('Con errores')).toBeInTheDocument();
	});

	it('valid row appears in editable table with Nuevo badge', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(screen.getByDisplayValue('Ana')).toBeInTheDocument();
		expect(screen.getByText('Nuevo')).toBeInTheDocument();
	});

	it('error row is editable and fixable inline', () => {
		importCsv('full_name,phone,country_code\nAna,6691234567,');
		// Country code input should be empty and show error
		const inputs = screen.getAllByRole('textbox');
		expect(inputs[1]).toHaveValue('Ana');
		expect(inputs[3]).toHaveValue('');
		// Fix by adding country code
		fireEvent.change(inputs[3], { target: { value: '+52' } });
		// Error should clear and button should become enabled
		expect(getImportButton().disabled).toBe(false);
	});

	it('import is disabled when only error rows exist', () => {
		importCsv('full_name,phone,country_code\nAna,6691234567,');
		expect(getImportButton().disabled).toBe(true);
	});

	it('import is enabled when all rows are valid', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,');
		expect(getImportButton().disabled).toBe(false);
	});

	it('mixed valid and invalid rows: import enabled when valid rows exist', async () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,6691234567,');
		expect(screen.getAllByText('Nuevo')).toHaveLength(1);
		expect(screen.getAllByText('Con errores')).toHaveLength(1);
		expect(getImportButton().disabled).toBe(false);
		expect(getImportButton().textContent).toContain('Importar 1 cambio');
	});

	it('fixing error row enables import button', () => {
		importCsv('full_name,phone,country_code\nAna,+526691234567,\nLuis,6691234567,');
		const inputs = screen.getAllByRole('textbox');
		fireEvent.change(inputs[7], { target: { value: '+52' } });
		expect(getImportButton().disabled).toBe(false);
	});
});

describe('import payload', () => {
	it('editing country code changes the normalized phone sent to onImport', async () => {
		const { onImport } = renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nLuis,6691234567,');
		const inputs = screen.getAllByRole('textbox');
		fireEvent.change(inputs[3], { target: { value: '+52' } });
		fireEvent.click(getImportButton());
		await screen.findByText(/Resultado de la importación/i);
		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ fullName: 'Luis', phone: '+526691234567' }),
			]),
		);
	});

	it('submits normalized phone for valid guest with phone+country_code', async () => {
		const { onImport } = renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nAna,6563769461,+52');
		fireEvent.click(getImportButton());
		await screen.findByText(/Resultado de la importación/i);
		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ fullName: 'Ana', phone: '+526563769461' }),
			]),
		);
	});

	it('submits undefined phone for guest without phone', async () => {
		const { onImport } = renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv('full_name,phone,country_code\nSin Teléfono,,');
		fireEvent.click(getImportButton());
		await screen.findByText(/Resultado de la importación/i);
		const callArg = onImport.mock.calls[0][0];
		const noPhoneGuest = callArg.find(
			(g: { fullName: string }) => g.fullName === 'Sin Teléfono',
		);
		expect(noPhoneGuest.phone).toBeUndefined();
	});

	it('mixed import: guests with and without phone are both submitted', async () => {
		const { onImport } = renderModal();
		await screen.findByPlaceholderText(/Ejemplo:/i);
		importCsv(
			'full_name,phone,country_code\ntist,6563769461,+52\ntist1,,\ntist2,6681167477,+52',
		);
		fireEvent.click(getImportButton());
		await screen.findByText(/Resultado de la importación/i);
		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ fullName: 'tist', phone: '+526563769461' }),
				expect.objectContaining({ fullName: 'tist1' }),
				expect.objectContaining({ fullName: 'tist2', phone: '+526681167477' }),
			]),
		);
		expect(onImport.mock.calls[0][0]).toHaveLength(3);
	});
});

describe('action-aware duplicate review', () => {
	const existingAna = (): DashboardGuestItem[] => [
		{
			guestId: 'guest-ana',
			inviteId: 'invite-ana',
			fullName: 'Ana López',
			phone: '+526691234567',
			phoneCountryCode: '+52',
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

	it('checkbox reveals hidden exact duplicates', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', existingAna());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna López,+526691234567,');
		expect(screen.queryByDisplayValue('Ana López')).toBeNull();

		fireEvent.click(screen.getByLabelText(/Mostrar posibles duplicados/i));
		expect(screen.getByDisplayValue('Ana López')).toBeInTheDocument();
		expect(screen.getByText('Duplicado exacto')).toBeInTheDocument();
	});

	it('editing duplicate name and phone makes it importable', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', existingAna());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna López,+526691234567,');
		fireEvent.click(screen.getByLabelText(/Mostrar posibles duplicados/i));
		fireEvent.change(screen.getByDisplayValue('Ana López'), {
			target: { value: 'Luis Pérez' },
		});
		fireEvent.change(screen.getByDisplayValue('+526691234567'), {
			target: { value: '+525551234567' },
		});

		expect(screen.getByText('Nuevo')).toBeInTheDocument();
		expect(getImportButton()).not.toBeDisabled();
	});

	it('same name with different phone remains visible and reviewable', async () => {
		renderModal('550e8400-e29b-41d4-a716-446655440000', existingAna());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna Lopez,+525551234567,');
		expect(screen.getByDisplayValue('Ana Lopez')).toBeInTheDocument();
		expect(screen.getByText('Revisar nombre')).toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveValue('create');
	});

	it('action selector controls create and update submission', async () => {
		const { onImport, onUpdate } = renderModal(
			'550e8400-e29b-41d4-a716-446655440000',
			existingAna(),
		);
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna Familia,+526691234567,\nNuevo,+525551234567,');
		fireEvent.click(getImportButton());

		await screen.findByText(/Resultado de la importación/i);
		expect(onUpdate).toHaveBeenCalledWith(
			'guest-ana',
			expect.objectContaining({ fullName: 'Ana Familia', phone: '+526691234567' }),
		);
		expect(onImport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ fullName: 'Nuevo', phone: '+525551234567' }),
			]),
		);
		const createPayload = onImport.mock.calls[0][0][0];
		expect(createPayload).toHaveProperty('phone');
		expect(createPayload).not.toHaveProperty('phone_');
	});

	it('can skip a visible review conflict', async () => {
		const { onImport } = renderModal('550e8400-e29b-41d4-a716-446655440000', existingAna());
		await screen.findByPlaceholderText(/Ejemplo:/i);

		importCsv('full_name,phone,country_code\nAna Lopez,+525551234567,');
		fireEvent.change(screen.getByRole('combobox'), { target: { value: 'skip' } });

		expect(getImportButton()).toBeDisabled();
		expect(onImport).not.toHaveBeenCalled();
	});
});
