import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UsersAdminTable from '@/components/dashboard/users/UsersAdminTable';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { UserListItemDTO } from '@/lib/dashboard/dto/users';

jest.mock('@/lib/dashboard/admin-api', () => ({
	adminApi: {
		listUsers: jest.fn(),
		listEvents: jest.fn(),
		updateUserEventMembership: jest.fn(),
	},
}));

const ASSIGNED_EVENT = { eventId: 'event-1', title: 'Boda A', slug: 'boda-a' };
const FREE_EVENT = { id: 'event-2', title: 'Boda B', slug: 'boda-b' };

function host(role: 'owner' | 'manager'): UserListItemDTO {
	return {
		id: 'synthetic-user',
		email: 'host@example.test',
		role: 'host_client',
		createdAt: '',
		assignedEvents: [{ ...ASSIGNED_EVENT, membershipRole: role }],
	};
}

function renderTable(role: 'owner' | 'manager') {
	jest.mocked(adminApi.listUsers).mockResolvedValue({
		items: [host(role)],
		total: 1,
		page: 1,
		perPage: 50,
	});
	jest.mocked(adminApi.listEvents).mockResolvedValue({
		items: [{ id: ASSIGNED_EVENT.eventId, title: 'Boda A', slug: 'boda-a' }, FREE_EVENT],
	} as never);
	jest.mocked(adminApi.updateUserEventMembership).mockResolvedValue({
		userId: 'synthetic-user',
		eventId: FREE_EVENT.id,
		action: 'assign',
		membershipRole: 'owner',
		previousMembershipRole: null,
		changedAt: '',
	});
	render(<UsersAdminTable />);
}

beforeEach(() => jest.clearAllMocks());

it('shows the role of each assigned event with its visible name', async () => {
	renderTable('manager');

	const chipRole = await screen.findByRole('combobox', {
		name: 'Rol de host@example.test en Boda A',
	});
	expect(chipRole).toHaveValue('manager');
	expect(chipRole).toHaveDisplayValue('Colaborador');
	expect(screen.getByText(/Solo el anfitrión principal ve Recuerdos/)).toBeInTheDocument();
});

it('changes the role of an assigned event in place', async () => {
	renderTable('manager');

	const chipRole = await screen.findByRole('combobox', {
		name: 'Rol de host@example.test en Boda A',
	});
	fireEvent.change(chipRole, { target: { value: 'owner' } });

	await waitFor(() =>
		expect(adminApi.updateUserEventMembership).toHaveBeenCalledWith('synthetic-user', {
			eventId: ASSIGNED_EVENT.eventId,
			action: 'assign',
			membershipRole: 'owner',
		}),
	);
});

it('assigns a new event as main host by default', async () => {
	renderTable('owner');

	const roleForNext = await screen.findByRole('combobox', {
		name: 'Rol para el próximo evento de host@example.test',
	});
	expect(roleForNext).toHaveValue('owner');
	fireEvent.change(screen.getByRole('combobox', { name: 'Asignar evento a host@example.test' }), {
		target: { value: FREE_EVENT.id },
	});

	await waitFor(() =>
		expect(adminApi.updateUserEventMembership).toHaveBeenCalledWith('synthetic-user', {
			eventId: FREE_EVENT.id,
			action: 'assign',
			membershipRole: 'owner',
		}),
	);
});

it('assigns a new event as collaborator when chosen', async () => {
	renderTable('owner');

	fireEvent.change(
		await screen.findByRole('combobox', {
			name: 'Rol para el próximo evento de host@example.test',
		}),
		{ target: { value: 'manager' } },
	);
	fireEvent.change(screen.getByRole('combobox', { name: 'Asignar evento a host@example.test' }), {
		target: { value: FREE_EVENT.id },
	});

	await waitFor(() =>
		expect(adminApi.updateUserEventMembership).toHaveBeenCalledWith('synthetic-user', {
			eventId: FREE_EVENT.id,
			action: 'assign',
			membershipRole: 'manager',
		}),
	);
});
