import { fireEvent, render, screen, within } from '@testing-library/react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import GuestDetailSheet from '@/components/dashboard/guests/GuestDetailSheet';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <button type="button">Compartir invitación</button>,
}));

jest.mock('@/components/dashboard/guests/GuestExpandedActions', () => ({
	__esModule: true,
	default: ({ onEdit }: { onEdit: () => void }) => (
		<button type="button" onClick={onEdit}>
			Editar
		</button>
	),
}));

const baseProps = {
	inviteUrl: 'https://example.com/invite/1',
	eventTitle: 'XV Años de Sofía',
	shareTemplates: {
		invitation: 'Hola {guestName}: {inviteUrl}',
		reminder: 'Hola {guestName}, recuerde: {inviteUrl}',
	},
	shareDateContext: defaultShareDateContext(),
	onEdit: jest.fn(),
	onDelete: jest.fn().mockResolvedValue(undefined),
	onMarkShared: jest.fn().mockResolvedValue(undefined),
};

describe('GuestDetailSheet', () => {
	it('shows the guest, the journey and the next step in one dialog', () => {
		const guest = makeGuest({ fullName: 'Familia Pérez López', maxAllowedAttendees: 4 });
		render(<GuestDetailSheet item={guest} onClose={jest.fn()} {...baseProps} />);

		const dialog = screen.getByRole('dialog', { name: 'Familia Pérez López' });
		expect(within(dialog).getByText(/4 personas invitadas/)).toBeInTheDocument();

		const steps = within(dialog).getAllByRole('listitem');
		expect(steps.map((step) => step.textContent)).toEqual([
			'1Enviar la invitaciónAhora',
			'2Esperar su respuestaPendiente',
			'3Saber si vienen y cuántosPendiente',
		]);
		expect(
			within(dialog).getByRole('button', { name: 'Compartir invitación' }),
		).toBeInTheDocument();
	});

	it('routes edits to the parent and closes from the header', () => {
		const onClose = jest.fn();
		const onEdit = jest.fn();
		const guest = makeGuest();
		render(<GuestDetailSheet item={guest} {...baseProps} onEdit={onEdit} onClose={onClose} />);

		fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
		expect(onEdit).toHaveBeenCalledWith(guest);

		fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
		expect(onClose).toHaveBeenCalled();
	});
});

describe('GuestCard with a detail screen', () => {
	it('offers "Ver detalles" instead of expanding in place', () => {
		const onOpenDetails = jest.fn();
		const guest = makeGuest({ fullName: 'Tía Carmen' });
		render(<GuestCard item={guest} index={0} {...baseProps} onOpenDetails={onOpenDetails} />);

		expect(screen.queryByRole('region', { name: 'Detalles de Tía Carmen' })).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Tía Carmen' }));
		expect(onOpenDetails).toHaveBeenCalledWith(guest);
	});
});
