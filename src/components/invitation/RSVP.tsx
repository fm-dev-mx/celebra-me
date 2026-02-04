import React, { useState } from 'react';
import '@/styles/invitation/_rsvp.scss';

interface RSVPProps {
	title: string;
	guestCap: number;
	confirmationMessage: string;
}

const RSVP: React.FC<RSVPProps> = ({ title, guestCap, confirmationMessage }) => {
	const [attendance, setAttendance] = useState<'yes' | 'no' | null>(null);
	const [guestCount, setGuestCount] = useState<number | ''>(1);
	const [notes, setNotes] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (attendance === 'yes' && Number(guestCount) > guestCap) {
			setError(`El límite de invitados es de ${guestCap}.`);
			return;
		}
		setError(null);
		setSubmitted(true);
	};

	if (submitted) {
		return (
			<section className="rsvp__greeting">
				<div className="rsvp__greeting-message">
					{attendance === 'yes' ? (
						<p>{confirmationMessage}</p>
					) : (
						<p>Sentimos mucho que no puedas acompañarnos, ¡gracias por avisarnos!</p>
					)}
				</div>
			</section>
		);
	}

	return (
		<section className="rsvp">
			<h2 className="rsvp__title">{title}</h2>
			<form
				onSubmit={handleSubmit}
				className="rsvp__form"
				aria-label="Confirmación de asistencia"
			>
				<div className="rsvp__field">
					<label>¿Podrás asistir?</label>
					<div className="rsvp__radio-group">
						<label>
							<input
								type="radio"
								name="attendance"
								value="yes"
								onChange={() => setAttendance('yes')}
								required
							/>
							Sí, asistiré
						</label>
						<label>
							<input
								type="radio"
								name="attendance"
								value="no"
								onChange={() => setAttendance('no')}
								required
							/>
							No podré asistir
						</label>
					</div>
				</div>

				{attendance === 'yes' && (
					<>
						<div className="rsvp__field">
							<label htmlFor="guestCount">
								Número de acompañantes (Máx. {guestCap})
							</label>
							<input
								type="number"
								id="guestCount"
								min="1"
								max={guestCap}
								value={guestCount}
								onChange={(e) => {
									const val = e.target.value;
									setGuestCount(val === '' ? '' : parseInt(val));
								}}
								required
							/>
							{error && <span className="rsvp__error">{error}</span>}
						</div>
						<div className="rsvp__field">
							<label htmlFor="notes">Notas adicionales (Alergias, etc.)</label>
							<textarea
								id="notes"
								rows={3}
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</div>
					</>
				)}

				{attendance === 'no' && (
					<div className="rsvp__message-not-attending">
						Te extrañaremos, pero agradecemos tu confirmación.
					</div>
				)}

				<button type="submit" className="rsvp__button">
					Confirmar
				</button>
			</form>
		</section>
	);
};

export default RSVP;
