import { act, fireEvent, render, screen, within } from '@testing-library/react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import GuestDetailSheet from '@/components/dashboard/guests/GuestDetailSheet';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <button type="button">Compartir invitación</button>,
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
	it('leads with the status, the three steps and the next step', () => {
		const guest = makeGuest({ fullName: 'Familia Pérez López', maxAllowedAttendees: 4 });
		render(<GuestDetailSheet item={guest} onClose={jest.fn()} {...baseProps} />);

		const dialog = screen.getByRole('dialog', { name: 'Familia Pérez López' });
		expect(within(dialog).getByText(/4 pases/)).toBeInTheDocument();
		expect(within(dialog).getAllByText('Por enviar').length).toBeGreaterThan(0);

		const steps = within(within(dialog).getByRole('list', { name: 'Avance' })).getAllByRole(
			'listitem',
		);
		expect(steps.map((step) => step.textContent)).toEqual([
			'Enviada: en cursoPendiente',
			'Abierta: pendiente',
			'Respuesta: pendientePendiente',
		]);
		expect(
			within(dialog).getByRole('button', { name: 'Compartir invitación' }),
		).toBeInTheDocument();
	});

	it('keeps copy, edit and more actions in the footer for every status', () => {
		for (const attendanceStatus of ['pending', 'confirmed', 'declined'] as const) {
			const { unmount } = render(
				<GuestDetailSheet
					item={makeGuest({ attendanceStatus, deliveryStatus: 'shared' })}
					onClose={jest.fn()}
					{...baseProps}
				/>,
			);
			const footer = screen.getByRole('group', { name: 'Acciones para Guest One' });
			expect(
				within(footer).getByRole('button', { name: 'Copiar enlace' }),
			).toBeInTheDocument();
			expect(within(footer).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
			expect(
				within(footer).getByRole('button', { name: 'Más acciones' }),
			).toBeInTheDocument();
			unmount();
		}
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

	it('puts mark, creator and delete behind "Más acciones"', () => {
		const onDelete = jest.fn().mockResolvedValue(undefined);
		const onToggleBrandingRemoval = jest.fn();
		const guest = makeGuest({ deliveryStatus: 'shared', guestId: 'g-9' });
		render(
			<GuestDetailSheet
				item={guest}
				onClose={jest.fn()}
				{...baseProps}
				onDelete={onDelete}
				onRevertShared={jest.fn().mockResolvedValue(undefined)}
				isBrandingRemovalEligible
				onToggleBrandingRemoval={onToggleBrandingRemoval}
			/>,
		);

		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
		const menu = screen.getByRole('menu');
		expect(
			within(menu)
				.getAllByRole('menuitem')
				.map((i) => i.textContent),
		).toEqual([
			'Marcar como no enviada',
			'Ocultar creador en la invitación',
			'Eliminar invitado…',
		]);

		fireEvent.click(
			within(menu).getByRole('menuitem', { name: 'Ocultar creador en la invitación' }),
		);
		expect(onToggleBrandingRemoval).toHaveBeenCalledWith('g-9', true);
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar invitado…' }));
		expect(onDelete).toHaveBeenCalledWith(guest);
	});

	it('marks as sent in one tap and offers "Deshacer"', async () => {
		const onMarkShared = jest.fn().mockResolvedValue(undefined);
		const onRevertShared = jest.fn().mockResolvedValue(undefined);
		const guest = makeGuest({ deliveryStatus: 'generated' });
		render(
			<GuestDetailSheet
				item={guest}
				onClose={jest.fn()}
				{...baseProps}
				onMarkShared={onMarkShared}
				onRevertShared={onRevertShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
		await act(async () => {
			fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar como enviada' }));
		});
		expect(onMarkShared).toHaveBeenCalledWith(guest);
		expect(screen.getByText('Marcada como enviada.')).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
		});
		expect(onRevertShared).toHaveBeenCalledWith(guest);
		expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument();
	});

	it('closes the actions menu with Escape without closing the dialog', () => {
		const onClose = jest.fn();
		render(<GuestDetailSheet item={makeGuest()} onClose={onClose} {...baseProps} />);

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('changes the group from "Más datos" with an explicit save', async () => {
		const onUpdateGroups = jest.fn().mockResolvedValue(undefined);
		render(
			<GuestDetailSheet
				item={makeGuest({ guestId: 'g-1', tags: ['Familia', 'system:public'] })}
				onClose={jest.fn()}
				{...baseProps}
				onUpdateGroups={onUpdateGroups}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Más datos/ }));
		fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
		fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Guardar grupo' }));
		});

		expect(onUpdateGroups).toHaveBeenCalledWith('g-1', ['Familia', 'VIP']);
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
