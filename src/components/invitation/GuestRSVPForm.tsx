import React, { useEffect, useState } from 'react';
import GuestPostConfirmActions from './GuestPostConfirmActions';

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
	const [attendanceStatus, setAttendanceStatus] = useState<'confirmed' | 'declined'>(
		initialStatus === 'declined' ? 'declined' : 'confirmed',
	);
	const [attendeeCount, setAttendeeCount] = useState(Math.max(1, initialAttendeeCount || 1));
	const [guestMessage, setGuestMessage] = useState(initialGuestMessage || '');
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(initialStatus !== 'pending');
	const [error, setError] = useState('');

	useEffect(() => {
		const run = async () => {
			try {
				await fetch(`/api/invitacion/${encodeURIComponent(inviteId)}/view`, {
					method: 'POST',
				});
			} catch {
				// non-blocking view telemetry
			}
		};
		void run();
	}, [inviteId]);

	return (
		<section className="guest-rsvp-form">
			<h2>Confirma tu asistencia</h2>
			<form
				onSubmit={async (event) => {
					event.preventDefault();
					setSubmitting(true);
					setError('');
					try {
						const response = await fetch(
							`/api/invitacion/${encodeURIComponent(inviteId)}/rsvp`,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									attendanceStatus,
									attendeeCount:
										attendanceStatus === 'declined' ? 0 : attendeeCount,
									guestMessage,
								}),
							},
						);
						const data = (await response.json()) as { message?: string };
						if (!response.ok) {
							setError(data.message || 'No se pudo guardar RSVP.');
							return;
						}
						setSubmitted(true);
					} catch {
						setError('Error de red al guardar RSVP.');
					} finally {
						setSubmitting(false);
					}
				}}
			>
				<p>
					Invitado: <strong>{guestName}</strong>
				</p>
				<div className="guest-rsvp-form__row">
					<label>
						<input
							type="radio"
							name="attendanceStatus"
							checked={attendanceStatus === 'confirmed'}
							onChange={() => setAttendanceStatus('confirmed')}
						/>
						Si asistire
					</label>
					<label>
						<input
							type="radio"
							name="attendanceStatus"
							checked={attendanceStatus === 'declined'}
							onChange={() => setAttendanceStatus('declined')}
						/>
						No podre asistir
					</label>
				</div>
				{attendanceStatus === 'confirmed' && (
					<label>
						Numero de asistentes (maximo {maxAllowedAttendees})
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
