import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuestRowMenu from '@/components/dashboard/guests/GuestRowMenu';

const renderMenu = () =>
	render(
		<>
			<GuestRowMenu
				guestName="Carlos"
				inviteUrl="https://example.com/i/carlos"
				showCopy
				message={{ open: false, onToggle: jest.fn() }}
				onOpenDetails={jest.fn()}
			/>
			<button type="button">Siguiente fila</button>
		</>,
	);

const trigger = () => screen.getByRole('button', { name: 'Más acciones de Carlos' });

describe('GuestRowMenu — keyboard', () => {
	it('moves focus into the portaled menu and cycles its items with the arrow keys', async () => {
		const user = userEvent.setup();
		renderMenu();

		trigger().focus();
		await user.keyboard('{Enter}');
		const items = screen.getAllByRole('menuitem');
		expect(items.map((item) => item.textContent)).toEqual([
			'Copiar enlace',
			'Ver mensaje',
			'Ver detalles',
		]);
		expect(items[0]).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(items[1]).toHaveFocus();
		await user.keyboard('{End}');
		expect(items[2]).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(items[0]).toHaveFocus();
		await user.keyboard('{ArrowUp}');
		expect(items[2]).toHaveFocus();
		await user.keyboard('{Home}');
		expect(items[0]).toHaveFocus();
	});

	it('returns focus to the trigger when the menu closes', async () => {
		const user = userEvent.setup();
		renderMenu();

		trigger().focus();
		await user.keyboard('{Enter}');
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(trigger()).toHaveFocus();

		await user.keyboard('{Enter}');
		await user.keyboard('{ArrowDown}{Enter}');
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(trigger()).toHaveFocus();
	});

	it('continues the tab order after the trigger, not at the end of the page', async () => {
		const user = userEvent.setup();
		renderMenu();

		trigger().focus();
		await user.keyboard('{Enter}');
		await user.tab();
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Siguiente fila' })).toHaveFocus();

		trigger().focus();
		await user.keyboard('{Enter}');
		await user.tab({ shift: true });
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(trigger()).toHaveFocus();
	});

	it('leaves focus alone when a pointer dismisses the menu', async () => {
		const user = userEvent.setup();
		renderMenu();

		trigger().focus();
		await user.keyboard('{Enter}');
		await user.click(document.body);
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(trigger()).not.toHaveFocus();
	});
});
