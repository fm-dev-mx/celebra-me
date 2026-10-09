import React, { useState } from 'react';
import { ChevronDownGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';

const STATUS_SUMMARY: Record<AttendanceStatus, string> = {
	pending: 'Sin respuesta',
	confirmed: 'Confirmó',
	declined: 'No asistirá',
};

interface GuestResponseFieldsProps {
	status: AttendanceStatus;
	attendeeCount: number;
	maxAttendees: number;
	onStatusChange: (status: AttendanceStatus) => void;
	onAttendeeCountChange: (count: number) => void;
	error?: string;
}

/** Manual RSVP correction, edit mode only and collapsed: rarely needed, never in the way. */
export const GuestResponseFields: React.FC<GuestResponseFieldsProps> = ({
	status,
	attendeeCount,
	maxAttendees,
	onStatusChange,
	onAttendeeCountChange,
	error,
}) => {
	const [open, setOpen] = useState(Boolean(error));
	const summary =
		status === 'confirmed'
			? `${STATUS_SUMMARY.confirmed} · ${attendeeCount} ${attendeeCount === 1 ? 'persona' : 'personas'}`
			: STATUS_SUMMARY[status];

	return (
		<section className="guest-form__response">
			<button
				type="button"
				className="guest-form__response-toggle"
				aria-expanded={open || Boolean(error)}
				aria-controls="guest-response-fields"
				onClick={() => setOpen((value) => !value)}
			>
				<span>Respuesta del invitado</span>
				<span className="guest-form__response-summary">{summary}</span>
				<ChevronDownGlyph size={18} />
			</button>
			{(open || error) && (
				<div id="guest-response-fields" className="guest-form__response-fields">
					<p className="guest-field-hint">Cámbiela solo si necesita corregirla.</p>
					<div className="dashboard-form-field">
						<label htmlFor="attendanceStatus">Respuesta</label>
						<select
							id="attendanceStatus"
							value={status}
							onChange={(event) =>
								onStatusChange(event.target.value as AttendanceStatus)
							}
						>
							<option value="pending">Sin respuesta</option>
							<option value="confirmed">Confirmó</option>
							<option value="declined">No asistirá</option>
						</select>
					</div>
					{status === 'confirmed' && (
						<div className="dashboard-form-field">
							<label htmlFor="attendeeCount">Personas que vienen</label>
							<input
								id="attendeeCount"
								type="number"
								min={1}
								max={maxAttendees}
								value={attendeeCount}
								onChange={(event) =>
									onAttendeeCountChange(Number(event.target.value))
								}
							/>
						</div>
					)}
					{error && <span className="guest-field-error">{error}</span>}
				</div>
			)}
		</section>
	);
};

interface GuestFormFooterProps {
	mode: 'create' | 'edit';
	saving: boolean;
	isInvitationFactory: boolean;
	onClose: () => void;
	onPostpone?: () => void;
	onSaveAndAddAnother: () => void;
}

/** Primary save first and always visible; secondary choices as quiet text buttons. */
export const GuestFormFooter: React.FC<GuestFormFooterProps> = ({
	mode,
	saving,
	isInvitationFactory,
	onClose,
	onPostpone,
	onSaveAndAddAnother,
}) => {
	let primaryLabel = mode === 'create' ? 'Guardar' : 'Guardar cambios';
	if (isInvitationFactory) primaryLabel = 'Confirmar y enviar';
	if (saving) primaryLabel = 'Guardando…';

	return (
		<div className="guest-form__footer">
			<button type="submit" form="guest-form" className="btn-primary" disabled={saving}>
				{primaryLabel}
			</button>
			<div className="guest-form__footer-secondary">
				{mode === 'create' && (
					<button
						type="button"
						className="guest-form__text-btn guest-form__text-btn--strong"
						disabled={saving}
						onClick={onSaveAndAddAnother}
					>
						Guardar y agregar otro
					</button>
				)}
				{isInvitationFactory && onPostpone && (
					<button
						type="button"
						className="guest-form__text-btn"
						disabled={saving}
						onClick={onPostpone}
					>
						Posponer
					</button>
				)}
				<button
					type="button"
					className="guest-form__text-btn"
					disabled={saving}
					onClick={onClose}
				>
					Cancelar
				</button>
			</div>
		</div>
	);
};
