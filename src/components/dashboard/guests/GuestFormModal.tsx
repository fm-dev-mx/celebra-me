import React, { useEffect, useState } from 'react';
import type { DashboardGuestItem } from './types';

interface GuestFormModalProps {
	open: boolean;
	mode: 'create' | 'edit';
	initialGuest: DashboardGuestItem | null;
	onClose: () => void;
	onSubmit: (payload: {
		fullName: string;
		phoneE164: string;
		maxAllowedAttendees: number;
		attendanceStatus?: 'pending' | 'confirmed' | 'declined';
		attendeeCount?: number;
		guestMessage?: string;
	}) => Promise<void>;
}

const GuestFormModal: React.FC<GuestFormModalProps> = ({
	open,
	mode,
	initialGuest,
	onClose,
	onSubmit,
}) => {
	const [fullName, setFullName] = useState('');
	const [phoneE164, setPhoneE164] = useState('');
	const [maxAllowedAttendees, setMaxAllowedAttendees] = useState(1);
	const [attendanceStatus, setAttendanceStatus] = useState<'pending' | 'confirmed' | 'declined'>(
		'pending',
	);
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [guestMessage, setGuestMessage] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (!initialGuest) {
			setFullName('');
			setPhoneE164('');
			setMaxAllowedAttendees(1);
			setAttendanceStatus('pending');
			setAttendeeCount(0);
			setGuestMessage('');
			return;
		}
		setFullName(initialGuest.fullName);
		setPhoneE164(initialGuest.phoneE164);
		setMaxAllowedAttendees(initialGuest.maxAllowedAttendees);
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setGuestMessage(initialGuest.guestMessage || '');
	}, [initialGuest, open]);

	if (!open) return null;

	return (
		<div className="dashboard-guests__modal-backdrop" role="dialog" aria-modal="true">
			<div className="dashboard-guests__modal">
				<h3>{mode === 'create' ? 'Agregar invitado' : 'Editar invitado'}</h3>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						setSaving(true);
						try {
							await onSubmit({
								fullName,
								phoneE164,
								maxAllowedAttendees,
								attendanceStatus: mode === 'edit' ? attendanceStatus : undefined,
								attendeeCount: mode === 'edit' ? attendeeCount : undefined,
								guestMessage: mode === 'edit' ? guestMessage : undefined,
							});
							onClose();
						} finally {
							setSaving(false);
						}
					}}
				>
					<label>
						Nombre completo
						<input
							value={fullName}
							onChange={(event) => setFullName(event.target.value)}
							required
						/>
					</label>
					<label>
						Telefono (E.164)
						<input
							value={phoneE164}
							onChange={(event) => setPhoneE164(event.target.value)}
							required
						/>
					</label>
					<label>
						Maximo acompanantes
						<input
							type="number"
							min={1}
							max={20}
							value={maxAllowedAttendees}
							onChange={(event) => setMaxAllowedAttendees(Number(event.target.value))}
							required
						/>
					</label>
					{mode === 'edit' && (
						<>
							<label>
								Estado
								<select
									value={attendanceStatus}
									onChange={(event) =>
										setAttendanceStatus(
											event.target.value as
												| 'pending'
												| 'confirmed'
												| 'declined',
										)
									}
								>
									<option value="pending">Pendiente</option>
									<option value="confirmed">Confirmado</option>
									<option value="declined">Declinado</option>
								</select>
							</label>
							<label>
								Asistentes
								<input
									type="number"
									min={0}
									max={20}
									value={attendeeCount}
									onChange={(event) =>
										setAttendeeCount(Number(event.target.value))
									}
								/>
							</label>
							<label>
								Mensaje
								<textarea
									value={guestMessage}
									onChange={(event) => setGuestMessage(event.target.value)}
									rows={3}
								/>
							</label>
						</>
					)}
					<div className="dashboard-guests__modal-actions">
						<button type="button" onClick={onClose}>
							Cancelar
						</button>
						<button type="submit" disabled={saving}>
							{saving ? 'Guardando...' : 'Guardar'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default GuestFormModal;
