import { act, fireEvent, render, screen } from '@testing-library/react';
import ShareComposer from '@/components/dashboard/guests/ShareComposer';
import { copyToClipboard } from '@/utils/clipboard';

jest.mock('@/utils/clipboard', () => ({
	copyToClipboard: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/components/dashboard/guests/invitation-share', () => ({
	buildInvitationSharePayload: jest.fn((params) => ({
		title: 'Invitación Celebra-me',
		text: params.shareText,
		url: params.inviteUrl,
	})),
	canUseNativeShare: jest.fn(() => false),
	shareInvitationLink: jest.fn(),
}));

jest.mock('@/components/dashboard/ModalShell', () => {
	return {
		__esModule: true,
		default: ({
			title,
			subtitle,
			onClose,
			children,
		}: {
			title: string;
			subtitle?: string;
			onClose: () => void;
			className?: string;
			children: React.ReactNode;
		}) => (
			<div role="dialog" aria-label={title}>
				{subtitle && <p data-testid="modal-subtitle">{subtitle}</p>}
				<button onClick={onClose}>Cerrar</button>
				{children}
			</div>
		),
	};
});

const templates = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder:
		'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
};

function createComposer(overrides: Record<string, unknown> = {}) {
	const onShared = jest.fn().mockResolvedValue(undefined);
	const onClose = jest.fn();

	const utils = render(
		<ShareComposer
			guestName="María García"
			phone="6691234567"
			inviteUrl="https://example.com/invite/ABC123"
			eventTitle="XV Años"
			templates={templates}
			defaultMessageType="invitation"
			onShared={onShared}
			shareDateContext={{
				eventDate: '',
				daysUntilEvent: '',
				rsvpDeadline: '',
				eventTimingText: '',
				rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
			}}
			onClose={onClose}
			{...overrides}
		/>,
	);

	return { ...utils, onShared, onClose };
}

describe('ShareComposer', () => {
	let windowOpenSpy: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => {
		windowOpenSpy.mockRestore();
	});

	it('renders in a portal with dialog role', () => {
		createComposer();
		expect(screen.getByRole('dialog', { name: /compartir invitación/i })).toBeInTheDocument();
	});

	it('renders invitation and reminder toggle buttons', () => {
		createComposer();
		expect(screen.getByText('Invitación')).toBeInTheDocument();
		expect(screen.getByText('Recordatorio')).toBeInTheDocument();
	});

	it('defaults to invitation message type', () => {
		createComposer();
		const invitationBtn = screen.getByText('Invitación');
		expect(invitationBtn).toHaveClass('share-composer-modal__tab--active');
	});

	it('switches to reminder when reminder tab is clicked', () => {
		createComposer();
		fireEvent.click(screen.getByText('Recordatorio'));
		const reminderBtn = screen.getByText('Recordatorio');
		expect(reminderBtn).toHaveClass('share-composer-modal__tab--active');
	});

	it('shows WhatsApp button when phone is provided', () => {
		createComposer({ phone: '6691234567' });
		expect(screen.getByText('Enviar por WhatsApp')).toBeInTheDocument();
	});

	it('hides WhatsApp button when phone is empty', () => {
		createComposer({ phone: '' });
		expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
	});

	it('renders the rendered message preview', () => {
		createComposer();
		expect(screen.getByText(/Hola María García/)).toBeInTheDocument();
		expect(screen.getByText(/XV Años/)).toBeInTheDocument();
	});

	it('calls onShared when WhatsApp is clicked and opens window', async () => {
		const { onShared } = createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Enviar por WhatsApp'));
		});
		expect(window.open).toHaveBeenCalledWith(
			expect.stringContaining('wa.me/6691234567'),
			'_blank',
			'noopener,noreferrer',
		);
		expect(onShared).toHaveBeenCalledTimes(1);
	});

	it('calls onShared when copy message is clicked', async () => {
		const { onShared } = createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Copiar mensaje'));
		});
		expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('Hola María García'));
		expect(onShared).toHaveBeenCalledTimes(1);
	});

	it('calls onShared when copy link is clicked', async () => {
		const { onShared } = createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Copiar enlace'));
		});
		expect(copyToClipboard).toHaveBeenCalledWith('https://example.com/invite/ABC123');
		expect(onShared).toHaveBeenCalledTimes(1);
	});

	it('shows status message while sending', async () => {
		createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Copiar mensaje'));
		});
		expect(screen.getByText('Listo')).toBeInTheDocument();
	});

	it('defaults to reminder when defaultMessageType is reminder', () => {
		createComposer({ defaultMessageType: 'reminder' });
		const reminderBtn = screen.getByText('Recordatorio');
		expect(reminderBtn).toHaveClass('share-composer-modal__tab--active');
	});

	it('uses reminder template when reminder tab is active', () => {
		createComposer();
		fireEvent.click(screen.getByText('Recordatorio'));
		expect(screen.getByText(/nuevamente/)).toBeInTheDocument();
	});

	it('calls onClose when close button is clicked', () => {
		const { onClose } = createComposer();
		fireEvent.click(screen.getByText('Cerrar'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when Escape key is pressed', () => {
		const { onClose } = createComposer();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('shows guest context in subtitle with phone', () => {
		createComposer({ phone: '6691234567' });
		expect(screen.getByTestId('modal-subtitle')).toHaveTextContent(
			'Para: María García · WhatsApp disponible',
		);
	});

	it('shows guest context in subtitle without phone', () => {
		createComposer({ phone: '' });
		expect(screen.getByTestId('modal-subtitle')).toHaveTextContent(
			'Para: María García · Sin teléfono registrado',
		);
	});

	it('shows native share button when supported', async () => {
		const { canUseNativeShare } =
			await import('@/components/dashboard/guests/invitation-share');
		(canUseNativeShare as jest.Mock).mockReturnValue(true);

		createComposer();
		expect(screen.getByText('Compartir con otra app')).toBeInTheDocument();
	});

	it('calls onShared via native share when supported', async () => {
		const inviteShare = await import('@/components/dashboard/guests/invitation-share');
		(inviteShare.canUseNativeShare as jest.Mock).mockReturnValue(true);
		(inviteShare.shareInvitationLink as jest.Mock).mockResolvedValue('shared');

		const { onShared } = createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Compartir con otra app'));
		});
		expect(onShared).toHaveBeenCalledTimes(1);
	});

	it('resets to idle when native share is canceled', async () => {
		const inviteShare = await import('@/components/dashboard/guests/invitation-share');
		(inviteShare.canUseNativeShare as jest.Mock).mockReturnValue(true);
		(inviteShare.shareInvitationLink as jest.Mock).mockResolvedValue('canceled');

		const { onShared } = createComposer();
		const nativeBtn = screen.getByText('Compartir con otra app');
		fireEvent.click(nativeBtn);
		await act(async () => {
			await (inviteShare.shareInvitationLink as jest.Mock).mock.results[0]?.value;
		});
		expect(onShared).not.toHaveBeenCalled();
	});

	describe('WhatsApp URL country code', () => {
		it('includes country code when countryCode is provided', async () => {
			const { onShared } = createComposer({ countryCode: '+52' });
			await act(async () => {
				fireEvent.click(screen.getByText('Enviar por WhatsApp'));
			});
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/wa\.me\/526691234567/),
				'_blank',
				'noopener,noreferrer',
			);
			expect(onShared).toHaveBeenCalledTimes(1);
		});

		it('does not duplicate country code when phone already includes it', async () => {
			const { onShared } = createComposer({ phone: '526691234567', countryCode: '+52' });
			await act(async () => {
				fireEvent.click(screen.getByText('Enviar por WhatsApp'));
			});
			const calls = (window.open as jest.Mock).mock.calls[0];
			const url = calls[0] as string;
			const match = url.match(/wa\.me\/(\d+)/);
			expect(match?.[1]).toBe('526691234567');
			expect(onShared).toHaveBeenCalledTimes(1);
		});

		it('uses local phone as-is when no countryCode is provided', async () => {
			createComposer({ phone: '6691234567' });
			await act(async () => {
				fireEvent.click(screen.getByText('Enviar por WhatsApp'));
			});
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/wa\.me\/6691234567/),
				'_blank',
				'noopener,noreferrer',
			);
		});

		it('hides WhatsApp button when phone is missing even with countryCode', () => {
			createComposer({ phone: '', countryCode: '+52' });
			expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
			expect(screen.getByText('Copiar mensaje')).toBeInTheDocument();
			expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
		});
	});
});
