import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareAction from '@/components/dashboard/guests/ShareAction';

function createMockWindow() {
	return { closed: false, location: { href: '' }, close: jest.fn() };
}

function setupNavigatorShare(value: jest.Mock) {
	Object.defineProperty(navigator, 'share', {
		value,
		configurable: true,
		writable: true,
	});
}

describe('ShareAction', () => {
	let onShared: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		delete (navigator as unknown as Record<string, unknown>).share;
		onShared = jest.fn().mockResolvedValue(undefined);
		window.open = jest.fn().mockReturnValue(createMockWindow());
	});

	it('calls onShared when WhatsApp button is clicked', async () => {
		render(
			<ShareAction
				phone="6691234567"
				waShareUrl="https://wa.me/526691234567"
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
	});

	it('shows "Registrado" after successful share via WhatsApp', async () => {
		render(
			<ShareAction
				phone="6691234567"
				waShareUrl="https://wa.me/526691234567"
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		await waitFor(() => {
			expect(screen.getByText('Registrado')).toBeInTheDocument();
		});
	});

	it('calls onShared when copy fallback is used (no phone, no Web Share)', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: jest.fn().mockResolvedValue(undefined) },
			configurable: true,
			writable: true,
		});
		window.open = jest.fn().mockReturnValue(createMockWindow());

		render(
			<ShareAction
				phone=""
				waShareUrl=""
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button'));

		await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
	});

	it('calls navigator.share with the invitation payload for no-phone guests', async () => {
		const shareMock = jest.fn().mockResolvedValue(undefined);
		setupNavigatorShare(shareMock);

		render(
			<ShareAction
				phone=""
				waShareUrl=""
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() =>
			expect(shareMock).toHaveBeenCalledWith({
				title: 'Invitación Celebra-me',
				text: 'Share text',
				url: 'https://example.com/invite',
			}),
		);
		await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
		expect(window.open).not.toHaveBeenCalled();
	});

	it('treats native share cancellation as pending without marking shared', async () => {
		setupNavigatorShare(
			jest.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')),
		);

		render(
			<ShareAction
				phone=""
				waShareUrl=""
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => expect(navigator.share).toHaveBeenCalled());
		expect(onShared).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: /compartir invitación/i }),
			).toBeInTheDocument(),
		);
	});

	it('does not set or imply isViewed state — ShareAction has no isViewed prop', () => {
		const { container } = render(
			<ShareAction
				phone="6691234567"
				waShareUrl="https://wa.me/526691234567"
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				onShared={onShared}
			/>,
		);

		const btn = container.querySelector('button');
		expect(btn).toBeInTheDocument();
		expect(btn?.getAttribute('aria-label')).toBe('Enviar por WhatsApp');
	});

	it('shows "Enviar" label when not shared yet (WhatsApp mode)', () => {
		render(
			<ShareAction
				phone="6691234567"
				waShareUrl="https://wa.me/526691234567"
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				isShared={false}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Enviar')).toBeInTheDocument();
	});

	it('shows "Reenviar" label when already shared (WhatsApp mode)', () => {
		render(
			<ShareAction
				phone="6691234567"
				waShareUrl="https://wa.me/526691234567"
				inviteUrl="https://example.com/invite"
				shareText="Share text"
				isShared={true}
				onShared={onShared}
			/>,
		);

		expect(screen.getByText('Reenviar')).toBeInTheDocument();
	});
});
