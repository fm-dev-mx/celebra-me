import React, { useEffect, useState } from 'react';
import GuestPostConfirmActions from '@/components/invitation/GuestPostConfirmActions';
import { useGuestRsvp } from '@/hooks/use-guest-rsvp';

interface GuestRSVPFormProps {
	inviteId: string;
	eventTitle: string;
	guestName: string;
	maxAllowedAttendees: number;
	initialStatus: 'pending' | 'confirmed' | 'declined';
	initialAttendeeCount: number;
	initialGuestMessage: string;
	hostWhatsAppPhone?: string;
	eventStartIso?: string;
	eventEndIso?: string;
}

const GuestRSVPForm: React.FC<GuestRSVPFormProps> = ({
	inviteId,
	eventTitle,
	guestName,
	maxAllowedAttendees,
	initialStatus,
	initialAttendeeCount,
	initialGuestMessage,
	hostWhatsAppPhone,
	eventStartIso,
	eventEndIso,
}) => {
	const { submitting, error, submitted, markInviteViewed, submitGuestRsvp } = useGuestRsvp(
		inviteId,
		initialStatus !== 'pending',
	);
	const [attendanceStatus, setAttendanceStatus] = useState<'confirmed' | 'declined'>(
		initialStatus === 'declined' ? 'declined' : 'confirmed',
	);
	const [attendeeCount, setAttendeeCount] = useState(Math.max(1, initialAttendeeCount || 1));
	const [guestMessage, setGuestMessage] = useState(initialGuestMessage || '');

	useEffect(() => {
		void markInviteViewed();
	}, [markInviteViewed]);

	return (
		<section className="guest-rsvp-form">
			<h2>Confirma tu asistencia</h2>
			<form
				onSubmit={async (event) => {
					event.preventDefault();

					try {
						await submitGuestRsvp({
							attendanceStatus,
							attendeeCount: attendanceStatus === 'declined' ? 0 : attendeeCount,
							guestMessage,
						});
					} catch {
						// The hook keeps the current error state for the form.
					}
				}}
			>
				<div className="guest-rsvp-form__personalized-welcome">
					<p className="personalized-label">Especialmente para:</p>
					<strong className="personalized-name">{guestName}</strong>
				</div>
				<div className="guest-rsvp-form__row">
					<label>
						<input
							type="radio"
							name="attendanceStatus"
							checked={attendanceStatus === 'confirmed'}
							onChange={() => setAttendanceStatus('confirmed')}
						/>
						Sí asistiré
					</label>
					<label>
						<input
							type="radio"
							name="attendanceStatus"
							checked={attendanceStatus === 'declined'}
							onChange={() => setAttendanceStatus('declined')}
						/>
						No podré asistir
					</label>
				</div>
				{attendanceStatus === 'confirmed' && (
					<label>
						Número de asistentes (máximo {maxAllowedAttendees})
						<input
							type="number"
							min={1}
							max={maxAllowedAttendees}
							value={attendeeCount}
							onChange={(event) => setAttendeeCount(Number(event.target.value))}
						/>
					</label>
				)}
				<label>
					Mensaje para el festejado (opcional)
					<textarea
						value={guestMessage}
						onChange={(event) => setGuestMessage(event.target.value)}
						rows={4}
					/>
				</label>
				{error && <p className="guest-rsvp-form__error">{error}</p>}
				<button type="submit" disabled={submitting}>
					{submitting ? 'Enviando...' : 'Confirmar asistencia'}
				</button>
			</form>

			{submitted && (
				<GuestPostConfirmActions
					eventTitle={eventTitle}
					startIso={eventStartIso}
					endIso={eventEndIso}
					hostWhatsAppPhone={hostWhatsAppPhone}
					guestName={guestName}
					attendanceStatus={attendanceStatus}
				/>
			)}
		</section>
	);
};

export default GuestRSVPForm;
