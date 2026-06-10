import { act, renderHook } from '@testing-library/react';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	setupNavigatorShare,
	setupNavigatorClipboard,
	createMockWindow,
	stubWindowOpen,
} from '@tests/helpers/nav-test-utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';

const TEST_TEMPLATES: ShareMessagesConfig = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:',
	reminder: 'Hola {guestName}, {eventTimingText}',
};

function createMockCallbacks() {
	return {
		onSave: jest.fn(),
		onMarkShared: jest.fn(),
		onAdvanceFromGuest: jest.fn(),
		onPostponeGuest: jest.fn(),
	};
}

function setupHook(
	guest: DashboardGuestItem | null,
	pendingGuests: DashboardGuestItem[],
	overrides?: Partial<ReturnType<typeof createMockCallbacks>>,
) {
	const callbacks = { ...createMockCallbacks(), ...overrides };

	const { result } = renderHook(() =>
		useSendInvitation({
			guest,
			pendingGuests,
			inviteUrl: 'http://localhost/invitacion/invite-1',
			...callbacks,
		}),
	);

	return { result, callbacks };
}

describe('useSendInvitation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setupNavigatorShare();
		stubWindowOpen(createMockWindow() as unknown as Window);
	});

	it('initialises state from the selected guest', () => {
		const guest = makeGuest({
			guestId: 'g-1',
			fullName: 'Ana López',
			phone: '6691234567',
			countryCode: '+52',
			maxAllowedAttendees: 4,
		});
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editName).toBe('Ana López');
		expect(result.current.editPhone).toBe('6691234567');
		expect(result.current.editCountryCode).toBe('+52');
		expect(result.current.editMaxAttendees).toBe(4);
		expect(result.current.shareStatus).toBe('idle');
		expect(result.current.pendingCount).toBe(1);
		expect(result.current.canSendToPhone).toBe(true);
	});

	it('uses defaults when guest has no phone', () => {
		const guest = makeGuest({ phone: '', countryCode: undefined });
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editPhone).toBe('');
		expect(result.current.editCountryCode).toBe('+52');
		expect(result.current.canSendToPhone).toBe(false);
	});

	it('defaults to +52 country code when guest has no countryCode', () => {
		const guest = makeGuest({ countryCode: undefined });
		const { result } = setupHook(guest, [guest]);

		expect(result.current.editCountryCode).toBe('+52');
	});

	it('handlePostpone calls onPostponeGuest with the current guest ID', () => {
		const guest = makeGuest({ guestId: 'g-1' });
		const guest2 = makeGuest({ guestId: 'g-2' });
		const { result, callbacks } = setupHook(guest, [guest, guest2]);

		act(() => {
			result.current.handlePostpone();
		});

		expect(callbacks.onPostponeGuest).toHaveBeenCalledWith('g-1');
	});

	it('rejects invalid phone and does not call onSave', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '123' });
		const { result, callbacks } = setupHook(guest, [guest]);

		act(() => {
			result.current.handleSaveAndShare();
		});

		expect(result.current.phoneError).toBe(
			'Revisa el número de WhatsApp o déjalo vacío para elegir el contacto manualmente.',
		);
		expect(callbacks.onSave).not.toHaveBeenCalled();
	});

	it('pendingCount reflects only generated guests', () => {
		const guestA = makeGuest({ guestId: 'a', deliveryStatus: 'generated' });
		const guestB = makeGuest({ guestId: 'b', deliveryStatus: 'generated' });
		const guestC = makeGuest({ guestId: 'c', deliveryStatus: 'shared' });

		const { result } = setupHook(guestA, [guestA, guestB, guestC]);
		expect(result.current.pendingCount).toBe(2);
	});

	it('activeMessage includes invite URL when template lacks {inviteUrl}', () => {
		const guest = makeGuest({ guestId: 'g-1', shareText: 'Plain message without URL' });
		const { result } = setupHook(guest, [guest], {
			templates: TEST_TEMPLATES,
		});
		expect(result.current.activeMessage).toContain('http://localhost/invitacion/invite-1');
	});

	it('activeMessage does not duplicate invite URL when already present', () => {
		const guest = makeGuest({ guestId: 'g-1' });
		const customTemplate: ShareMessagesConfig = {
			invitation: 'Hola {guestName}, usa este enlace: http://localhost/invitacion/invite-1',
			reminder: 'Recordatorio: http://localhost/invitacion/invite-1',
		};
		const { result } = setupHook(guest, [guest], {
			templates: customTemplate,
		});
		const matches = result.current.activeMessage.match(
			/http:\/\/localhost\/invitacion\/invite-1/g,
		);
		expect(matches).toHaveLength(1);
	});

	it('local edited message without URL gets URL appended in activeMessage', () => {
		const guest = makeGuest({ guestId: 'g-1' });
		const { result } = setupHook(guest, [guest], {
			templates: TEST_TEMPLATES,
		});
		act(() => {
			result.current.handleEditMessage();
		});
		act(() => {
			result.current.handleUpdateLocalMessage('Custom message no url');
		});
		expect(result.current.activeMessage).toContain('http://localhost/invitacion/invite-1');
	});

	it('changing guest resets local message state', () => {
		const guestA = makeGuest({ guestId: 'g-a', fullName: 'Guest A' });
		const guestB = makeGuest({ guestId: 'g-b', fullName: 'Guest B' });
		const { result, rerender } = renderHook(
			({ guest }) =>
				useSendInvitation({
					guest,
					pendingGuests: [guestA, guestB],
					inviteUrl: 'http://localhost/invitacion/invite-1',
					onSave: jest.fn(),
					onMarkShared: jest.fn(),
				}),
			{ initialProps: { guest: guestA } },
		);

		act(() => {
			result.current.handleEditMessage();
		});
		act(() => {
			result.current.handleUpdateLocalMessage('Custom edit for A');
		});
		expect(result.current.editingMessage).toBe(true);
		expect(result.current.localMessageOverride).toBe('Custom edit for A');

		rerender({ guest: guestB });

		expect(result.current.editingMessage).toBe(false);
		expect(result.current.localMessageOverride).toBe('');
		expect(result.current.messageError).toBeNull();
	});

	it('rapid double-click on handleSaveAndShare opens WhatsApp only once', async () => {
		const guest = makeGuest({ guestId: 'g-1', phone: '6691234567' });
		const { result, callbacks } = setupHook(guest, [guest]);
		callbacks.onSave.mockResolvedValue(guest);
		callbacks.onMarkShared.mockResolvedValue(undefined);

		await act(async () => {
			await Promise.all([
				result.current.handleSaveAndShare(),
				result.current.handleSaveAndShare(),
				result.current.handleSaveAndShare(),
			]);
		});

		expect(window.open).toHaveBeenCalledTimes(1);
	});

	it('handleCopyMessageAction uses activeMessage with invite URL', async () => {
		const guest = makeGuest({ guestId: 'g-1', shareText: 'Copy this' });
		const { result, callbacks } = setupHook(guest, [guest], {
			templates: TEST_TEMPLATES,
		});
		callbacks.onSave.mockResolvedValue(guest);

		await act(async () => {
			await result.current.handleCopyMessageAction();
		});

		expect(navigator.clipboard.writeText).toHaveBeenCalled();
		const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
		expect(copiedText).toContain('http://localhost/invitacion/invite-1');
	});

	it('switches from reminder to invitation when deliveryStatus changes from shared to generated', () => {
		const shared = makeGuest({
			guestId: 'g-1',
			fullName: 'Same Guest',
			deliveryStatus: 'shared',
			firstSharedAt: '2026-01-15T10:00:00.000Z',
			shareText: '',
		});
		const generated = makeGuest({
			...shared,
			deliveryStatus: 'generated',
			firstSharedAt: '2026-01-15T10:00:00.000Z',
		});

		const { result, rerender } = renderHook(
			({
				guest,
				mode,
			}: {
				guest: DashboardGuestItem;
				mode?: import('@/components/dashboard/guests/guest-presenter').ShareFlowMode;
			}) =>
				useSendInvitation({
					guest,
					pendingGuests: [guest],
					inviteUrl: 'http://localhost/invitacion/invite-1',
					eventTitle: 'Test Event',
					templates: {
						invitation: 'INVITE: {guestName}',
						reminder: 'REMINDER: {guestName}',
					},
					onSave: jest.fn(),
					onMarkShared: jest.fn(),
					mode: mode ?? 'single-invitation',
				}),
			{ initialProps: { guest: shared, mode: 'single-reminder' as const } },
		);

		expect(result.current.activeMessage).toContain('REMINDER: Same Guest');

		rerender({ guest: generated, mode: 'single-invitation' });

		expect(result.current.activeMessage).toContain('INVITE: Same Guest');
	});

	it('generated guest with stale firstSharedAt uses invitation template', () => {
		const guest = makeGuest({
			guestId: 'g-1',
			fullName: 'Reverted Guest',
			deliveryStatus: 'generated',
			firstSharedAt: '2026-01-15T10:00:00.000Z',
			shareText: '',
		});

		const { result } = renderHook(() =>
			useSendInvitation({
				guest,
				pendingGuests: [guest],
				inviteUrl: 'http://localhost/invitacion/invite-1',
				eventTitle: 'Test Event',
				templates: {
					invitation: 'INVITE: {guestName}',
					reminder: 'REMINDER: {guestName}',
				},
				onSave: jest.fn(),
				onMarkShared: jest.fn(),
				mode: 'single-invitation',
			}),
		);

		expect(result.current.activeMessage).toContain('INVITE: Reverted Guest');
	});
});
