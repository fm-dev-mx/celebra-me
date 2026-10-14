import { render, screen, fireEvent } from '@testing-library/react';
import ImportMagic from '@/components/dashboard/guests/ImportMagic';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

/** Renders the ImportMagic modal with mocked callbacks and returns them. */
export function renderModal(
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

export function importCsv(content: string) {
	const textarea = screen.getByPlaceholderText(/Ejemplo:/i) as HTMLTextAreaElement;
	fireEvent.change(textarea, { target: { value: content } });
}

export function getImportButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: /importar/i }) as HTMLButtonElement;
}
