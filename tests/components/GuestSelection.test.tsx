import { fireEvent, render, screen, within } from '@testing-library/react';
import GuestBatchConfirm, {
	getBatchConfirmCopy,
} from '@/components/dashboard/guests/GuestBatchConfirm';
import GuestSelectRow from '@/components/dashboard/guests/GuestSelectRow';
import GuestSelectionBar from '@/components/dashboard/guests/GuestSelectionBar';
import { describeNewAnswers } from '@/components/dashboard/guests/use-guest-change-notice';
import { getBatchCandidates } from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const guests = [
	makeGuest({ guestId: 'a', fullName: 'Ana', deliveryStatus: 'generated' }),
	makeGuest({ guestId: 'b', fullName: 'Bruno', deliveryStatus: 'shared' }),
	makeGuest({ guestId: 'c', fullName: 'Carla', attendanceStatus: 'confirmed' }),
];

describe('getBatchCandidates', () => {
	it('keeps only selected guests the batch can act on', () => {
		const selected = new Set(['a', 'b', 'c']);
		expect(getBatchCandidates(guests, 'invitation', selected).map((g) => g.guestId)).toEqual([
			'a',
		]);
		expect(getBatchCandidates(guests, 'reminder', selected).map((g) => g.guestId)).toEqual([
			'b',
		]);
		expect(getBatchCandidates(guests, 'invitation', new Set(['b']))).toEqual([]);
	});
});

describe('GuestSelectRow', () => {
	it('toggles from anywhere on the row', () => {
		const onToggle = jest.fn();
		render(<GuestSelectRow item={guests[0]} selected={false} onToggle={onToggle} />);

		const checkbox = screen.getByRole('checkbox', { name: /Ana/ });
		expect(checkbox).not.toBeChecked();
		fireEvent.click(screen.getByText('4 personas · Sin enviar'));
		expect(onToggle).toHaveBeenCalledWith('a');
	});
});

describe('GuestSelectionBar', () => {
	const handlers = {
		onSelectAll: jest.fn(),
		onClearSelection: jest.fn(),
		onSend: jest.fn(),
		onRemind: jest.fn(),
		onFinish: jest.fn(),
	};

	it('labels each action with the guests it applies to', () => {
		render(
			<GuestSelectionBar
				selectedCount={3}
				totalCount={5}
				sendCount={1}
				remindCount={2}
				{...handlers}
			/>,
		);

		expect(screen.getByRole('status')).toHaveTextContent('3 de 5 seleccionados');
		fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación a 1' }));
		expect(handlers.onSend).toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Recordar a 2' }));
		expect(handlers.onRemind).toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Marcar todos' }));
		expect(handlers.onSelectAll).toHaveBeenCalled();
	});

	it('explains why no action is available', () => {
		render(
			<GuestSelectionBar
				selectedCount={0}
				totalCount={5}
				sendCount={0}
				remindCount={0}
				{...handlers}
			/>,
		);
		expect(screen.getByText('Toque los invitados que quiera elegir.')).toBeInTheDocument();
	});
});

describe('GuestBatchConfirm', () => {
	it('names the recipients and only starts after confirmation', () => {
		const onConfirm = jest.fn();
		const onClose = jest.fn();
		render(
			<GuestBatchConfirm
				kind="reminder"
				guests={guests.slice(0, 2)}
				onConfirm={onConfirm}
				onClose={onClose}
			/>,
		);

		const dialog = screen.getByRole('dialog', { name: '¿Recordar a 2 invitados?' });
		expect(within(dialog).getByText('Ana')).toBeInTheDocument();
		expect(within(dialog).getByText('Bruno')).toBeInTheDocument();
		fireEvent.click(within(dialog).getByRole('button', { name: 'No, regresar' }));
		expect(onClose).toHaveBeenCalled();
		expect(onConfirm).not.toHaveBeenCalled();
		fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, recordar ahora' }));
		expect(onConfirm).toHaveBeenCalled();
	});

	it('uses singular copy for one invitation', () => {
		expect(getBatchConfirmCopy('invitation', 1)).toEqual({
			title: '¿Enviar 1 invitación?',
			confirm: 'Sí, enviar ahora',
		});
	});
});

describe('describeNewAnswers', () => {
	const before = new Map(guests.map((g) => [g.guestId, g.attendanceStatus]));

	it('announces a single new answer by name', () => {
		const after = guests.map((g) =>
			g.guestId === 'b' ? { ...g, attendanceStatus: 'declined' as const } : g,
		);
		expect(describeNewAnswers(before, after)).toBe('Bruno avisó que no podrá ir');
	});

	it('summarizes several answers and ignores new or unchanged guests', () => {
		const after = [
			{ ...guests[0], attendanceStatus: 'confirmed' as const },
			{ ...guests[1], attendanceStatus: 'confirmed' as const },
			guests[2],
			makeGuest({ guestId: 'new', attendanceStatus: 'confirmed' }),
		];
		expect(describeNewAnswers(before, after)).toBe('2 invitados acaban de responder');
		expect(describeNewAnswers(before, guests)).toBeNull();
	});
});
