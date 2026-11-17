import React, { useId, useState } from 'react';
import type { DashboardRsvpWindow } from '@/interfaces/dashboard/guest.interface';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { RSVP_DEADLINE_MESSAGES, validateRsvpDeadline } from '@/lib/rsvp/rsvp-deadline';

interface GuestRsvpDeadlineEditorProps {
	eventId: string;
	window: DashboardRsvpWindow;
	onSaved: (window: DashboardRsvpWindow) => void;
}

type Feedback = { kind: 'error' | 'warning'; message: string } | null;

/**
 * Host control for the RSVP deadline. Validates in the event's time zone before
 * saving; a date already over needs a second, explicit confirmation because it
 * closes replies at once.
 */
const GuestRsvpDeadlineEditor: React.FC<GuestRsvpDeadlineEditorProps> = ({
	eventId,
	window: rsvpWindow,
	onSaved,
}) => {
	const inputId = useId();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(rsvpWindow.deadline ?? '');
	const [feedback, setFeedback] = useState<Feedback>(null);
	const [pendingPast, setPendingPast] = useState(false);
	const [saving, setSaving] = useState(false);

	const startEditing = () => {
		setValue(rsvpWindow.deadline ?? '');
		setFeedback(null);
		setPendingPast(false);
		setEditing(true);
	};

	const save = async (deadline: string | null, confirmPast: boolean) => {
		const check = validateRsvpDeadline({
			deadline,
			eventDate: rsvpWindow.eventDate,
			timeZone: rsvpWindow.eventTimeZone,
		});
		if (!check.ok) {
			setFeedback({ kind: 'error', message: RSVP_DEADLINE_MESSAGES[check.reason] });
			return;
		}
		if (check.past && !confirmPast) {
			setPendingPast(true);
			setFeedback({ kind: 'warning', message: RSVP_DEADLINE_MESSAGES.past });
			return;
		}
		setSaving(true);
		setFeedback(null);
		const result = await guestsApi.updateRsvpDeadline({
			eventId,
			deadline: check.deadline,
			confirmPast,
		});
		setSaving(false);
		if (result.ok) {
			setEditing(false);
			setPendingPast(false);
			onSaved(result.data);
			return;
		}
		if (result.code === 'deadline_in_past') {
			setPendingPast(true);
			setFeedback({ kind: 'warning', message: RSVP_DEADLINE_MESSAGES.past });
			return;
		}
		setFeedback({
			kind: 'error',
			message: result.message || 'No se pudo guardar la fecha límite. Intente de nuevo.',
		});
	};

	if (!editing) {
		return (
			<div className="guest-deadline">
				<p className="guest-overview__deadline">
					{rsvpWindow.label ? (
						<>
							Confirmar antes del <strong>{rsvpWindow.label}</strong>
						</>
					) : (
						'Sin fecha límite para confirmar'
					)}
				</p>
				{rsvpWindow.closed && (
					<p className="guest-deadline__status" role="status">
						Las confirmaciones están cerradas.
					</p>
				)}
				<button type="button" className="guest-form__text-btn" onClick={startEditing}>
					{rsvpWindow.deadline ? 'Cambiar fecha límite' : 'Poner fecha límite'}
				</button>
			</div>
		);
	}

	return (
		<form
			className="guest-deadline guest-deadline--editing"
			onSubmit={(event) => {
				event.preventDefault();
				void save(value || null, pendingPast);
			}}
		>
			<label className="guest-deadline__label" htmlFor={inputId}>
				Fecha límite para confirmar
			</label>
			<input
				id={inputId}
				className="guest-deadline__input"
				type="date"
				value={value}
				max={rsvpWindow.eventDate ?? undefined}
				onChange={(event) => {
					setValue(event.target.value);
					setFeedback(null);
					setPendingPast(false);
				}}
				aria-describedby={feedback ? `${inputId}-feedback` : undefined}
				disabled={saving}
			/>
			{feedback && (
				<p
					id={`${inputId}-feedback`}
					className={`guest-deadline__feedback guest-deadline__feedback--${feedback.kind}`}
					role={feedback.kind === 'error' ? 'alert' : 'status'}
				>
					{feedback.message}
				</p>
			)}
			<div className="guest-deadline__actions">
				<button type="submit" className="btn-primary btn--compact" disabled={saving}>
					{pendingPast ? 'Guardar y cerrar confirmaciones' : 'Guardar'}
				</button>
				{rsvpWindow.deadline && (
					<button
						type="button"
						className="guest-form__text-btn"
						disabled={saving}
						onClick={() => void save(null, false)}
					>
						Quitar fecha límite
					</button>
				)}
				<button
					type="button"
					className="guest-form__text-btn"
					disabled={saving}
					onClick={() => setEditing(false)}
				>
					Cancelar
				</button>
			</div>
		</form>
	);
};

export default GuestRsvpDeadlineEditor;
