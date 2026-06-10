import type { FC, SubmitEvent } from 'react';
import { useEffect, useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DemoSelector from '@/components/dashboard/intake/DemoSelector';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import { EVENT_TYPE_LABELS } from '@/lib/intake/labels';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

const INVITATIONS_INDEX_URL = '/dashboard/invitaciones';

const CreateInvitationFlow: FC = () => {
	const { createInvitation } = useInvitationAdmin();
	const [title, setTitle] = useState('');
	const [clientName, setClientName] = useState('');
	const [clientWhatsapp, setClientWhatsapp] = useState('');
	const [clientEmail, setClientEmail] = useState('');
	const [eventType, setEventType] = useState('');
	const [baseDemoId, setBaseDemoId] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const isValid = title.trim() && eventType && baseDemoId;
	const hasInput =
		title || clientName || clientWhatsapp || clientEmail || eventType || baseDemoId;

	useEffect(() => {
		if (!hasInput) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [hasInput]);

	const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isValid) {
			setError('Completa el título, el tipo de evento y el demo base.');
			return;
		}
		setSubmitting(true);
		setError('');
		try {
			const invitation = await createInvitation({
				title: title.trim(),
				eventType,
				baseDemoId,
				clientName: clientName.trim() || undefined,
				clientWhatsapp: clientWhatsapp.trim() || undefined,
				clientEmail: clientEmail.trim() || undefined,
			});
			window.location.href = `/dashboard/invitaciones/${invitation.id}/editar`;
		} catch (err) {
			setError(toErrorMessage(err, 'Error al crear la invitación.'));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="create-flow">
			<header className="create-flow__header">
				<a href={INVITATIONS_INDEX_URL} className="create-flow__back">
					&larr; Volver a invitaciones
				</a>
				<h1 className="create-flow__title">Nueva invitación</h1>
				<p className="create-flow__subtitle">
					Selecciona un demo base y completa los datos para comenzar.
				</p>
			</header>

			<form className="create-flow__form" onSubmit={handleSubmit}>
				<div className="intake-field">
					<label className="intake-field__label" htmlFor="cf-title">
						Título <span className="intake-field__required">*</span>
					</label>
					<input
						id="cf-title"
						className="intake-field__input"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Ej: Boda Ana &amp; Carlos"
						required
					/>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="cf-client">
						Cliente
					</label>
					<input
						id="cf-client"
						className="intake-field__input"
						value={clientName}
						onChange={(e) => setClientName(e.target.value)}
						placeholder="Nombre del cliente"
					/>
				</div>

				<div className="create-flow__row">
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="cf-whatsapp">
							WhatsApp
						</label>
						<input
							id="cf-whatsapp"
							className="intake-field__input"
							value={clientWhatsapp}
							onChange={(e) => setClientWhatsapp(e.target.value)}
							placeholder="+52 555 123 4567"
						/>
					</div>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="cf-email">
							Correo
						</label>
						<input
							id="cf-email"
							type="email"
							className="intake-field__input"
							value={clientEmail}
							onChange={(e) => setClientEmail(e.target.value)}
							placeholder="cliente@ejemplo.com"
						/>
					</div>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="cf-event-type">
						Tipo de evento <span className="intake-field__required">*</span>
					</label>
					<select
						id="cf-event-type"
						className="intake-field__select"
						value={eventType}
						onChange={(e) => {
							setEventType(e.target.value);
							setBaseDemoId('');
						}}
						required
					>
						<option value="">Seleccionar...</option>
						{EVENT_TYPES.map((value) => (
							<option key={value} value={value}>
								{EVENT_TYPE_LABELS[value]}
							</option>
						))}
					</select>
				</div>

				<div className="intake-field">
					<label className="intake-field__label">
						Demo base <span className="intake-field__required">*</span>
					</label>
					<DemoSelector
						eventType={eventType}
						selectedDemoId={baseDemoId}
						onChange={setBaseDemoId}
					/>
				</div>

				{error && <p className="intake-list__error">{error}</p>}

				<div className="create-flow__actions">
					<a href={INVITATIONS_INDEX_URL} className="btn-secondary">
						Cancelar
					</a>
					<button type="submit" className="btn-primary" disabled={!isValid || submitting}>
						{submitting ? 'Creando...' : 'Crear invitación'}
					</button>
				</div>
			</form>
		</div>
	);
};

export default CreateInvitationFlow;
