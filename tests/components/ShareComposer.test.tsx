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

const templates = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder:
		'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
};

function createComposer(overrides: Record<string, unknown> = {}) {
	const anchorEl = document.createElement('button');
	document.body.appendChild(anchorEl);
	const anchorRef = { current: anchorEl };
	const onShared = jest.fn().mockResolvedValue(undefined);
	const onClose = jest.fn();

	const utils = render(
		<ShareComposer
			anchorRef={anchorRef}
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

	return { ...utils, anchorEl, onShared, onClose };
}

let windowOpenSpy: jest.SpyInstance;

describe('ShareComposer', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => {
		windowOpenSpy.mockRestore();
		document.querySelectorAll('button').forEach((el) => {
			if (el.parentNode) el.parentNode.removeChild(el);
		});
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
		expect(invitationBtn).toHaveClass('share-composer__type-btn--active');
	});

	it('switches to reminder when reminder tab is clicked', () => {
		createComposer();
		fireEvent.click(screen.getByText('Recordatorio'));
		const reminderBtn = screen.getByText('Recordatorio');
		expect(reminderBtn).toHaveClass('share-composer__type-btn--active');
	});

	it('shows WhatsApp button when phone is provided', () => {
		createComposer({ phone: '6691234567' });
		expect(screen.getByText('WhatsApp')).toBeInTheDocument();
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
			fireEvent.click(screen.getByText('WhatsApp'));
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
		createComposer({ defaultMessageType: 'reminder' as const });
		const reminderBtn = screen.getByText('Recordatorio');
		expect(reminderBtn).toHaveClass('share-composer__type-btn--active');
	});

	it('uses reminder template when reminder tab is active', () => {
		createComposer();
		fireEvent.click(screen.getByText('Recordatorio'));
		expect(screen.getByText(/nuevamente/)).toBeInTheDocument();
	});

	it('calls onClose when clicking outside', () => {
		const { onClose } = createComposer();
		act(() => {
			fireEvent.mouseDown(document.body);
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('shows native share button when supported', async () => {
		const { canUseNativeShare } =
			await import('@/components/dashboard/guests/invitation-share');
		(canUseNativeShare as jest.Mock).mockReturnValue(true);

		createComposer();
		expect(screen.getByText('Compartir...')).toBeInTheDocument();
	});

	it('calls onShared via native share when supported', async () => {
		const inviteShare = await import('@/components/dashboard/guests/invitation-share');
		(inviteShare.canUseNativeShare as jest.Mock).mockReturnValue(true);
		(inviteShare.shareInvitationLink as jest.Mock).mockResolvedValue('shared');

		const { onShared } = createComposer();
		await act(async () => {
			fireEvent.click(screen.getByText('Compartir...'));
		});
		expect(onShared).toHaveBeenCalledTimes(1);
	});

	it('resets to idle when native share is canceled', async () => {
		const inviteShare = await import('@/components/dashboard/guests/invitation-share');
		(inviteShare.canUseNativeShare as jest.Mock).mockReturnValue(true);
		(inviteShare.shareInvitationLink as jest.Mock).mockResolvedValue('canceled');

		const { onShared } = createComposer();
		const nativeBtn = screen.getByText('Compartir...');
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
				fireEvent.click(screen.getByText('WhatsApp'));
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
				fireEvent.click(screen.getByText('WhatsApp'));
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
				fireEvent.click(screen.getByText('WhatsApp'));
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
