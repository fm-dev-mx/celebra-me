import React, { useState } from 'react';

interface ClaimCodeFormModalProps {
	onCreate: (payload: {
		eventId: string;
		maxUses: number;
		expiresAt: string | null;
	}) => Promise<void>;
}

const ClaimCodeFormModal: React.FC<ClaimCodeFormModalProps> = ({ onCreate }) => {
	const [eventId, setEventId] = useState('');
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState('');
	const [busy, setBusy] = useState(false);

	return (
		<form
			className="dashboard-form-grid"
			onSubmit={async (event) => {
				event.preventDefault();
				if (busy) return;
				setBusy(true);
				try {
					await onCreate({
						eventId: eventId.trim(),
						maxUses,
						expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
					});
					setEventId('');
					setMaxUses(1);
					setExpiresAt('');
				} finally {
					setBusy(false);
				}
			}}
		>
			<label>
				Event ID
				<input
					value={eventId}
					onChange={(event) => setEventId(event.target.value)}
					required
				/>
			</label>
			<label>
				Max Uses
				<input
					type="number"
					min={1}
					value={maxUses}
					onChange={(event) => setMaxUses(Number.parseInt(event.target.value || '1', 10))}
				/>
			</label>
			<label>
				Expira En
				<input
					type="datetime-local"
					value={expiresAt}
					onChange={(event) => setExpiresAt(event.target.value)}
				/>
			</label>
			<div className="dashboard-actions">
				<button type="submit" disabled={busy}>
					{busy ? 'Generando...' : 'Generar Claim Code'}
				</button>
			</div>
		</form>
	);
};

export default ClaimCodeFormModal;
