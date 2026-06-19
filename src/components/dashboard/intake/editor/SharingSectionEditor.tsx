import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	SHARE_MESSAGE_VARIABLES,
	SHARE_MESSAGE_VARIABLE_LABELS,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import type { ShareMessageContext } from '@/lib/rsvp/services/shared/share-message-renderer';

interface SharingValue {
	ogDescription?: string;
	invitation?: string;
	reminder?: string;
}

interface Props {
	value: SharingValue;
	onChange: (patch: SharingValue) => void;
	previewContext: ShareMessageContext;
	resetConfirm: {
		pending: boolean;
		confirm: () => void;
		cancel: () => void;
		request: () => void;
	};
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	visible?: boolean;
}

export default function SharingSectionEditor({
	value: sharing,
	onChange,
	previewContext: sharingPreviewContext,
	resetConfirm: sharingResetConfirm,
	dirty,
	error,
	success,
	sourceBadge,
	visible,
}: Props) {
	return (
		<SectionCard
			id="sharing"
			title="Plantillas de mensaje"
			description="Plantillas de mensaje para compartir la invitación por WhatsApp."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<Field
				label="Descripción para vista previa al compartir"
				value={sharing.ogDescription ?? ''}
				onChange={(value) => onChange({ ogDescription: value })}
				placeholder="Acompáñanos a celebrar los XV años de..."
				maxLength={200}
			/>
			<p className="invitation-editor__helper-text">
				Este texto aparece en la tarjeta de vista previa cuando compartes la invitación por
				WhatsApp u otras redes.
			</p>
			<TextArea
				label="Mensaje de invitación"
				value={sharing.invitation ?? ''}
				onChange={(value) => onChange({ invitation: value })}
				placeholder="Hola {guestName}, te comparto tu invitación a {eventTitle}..."
			/>
			<TextArea
				label="Mensaje de recordatorio"
				value={sharing.reminder ?? ''}
				onChange={(value) => onChange({ reminder: value })}
				placeholder={DEFAULT_REMINDER_MESSAGE}
			/>
			{[
				{
					label: 'invitaci\u00f3n',
					message: sharing.invitation,
					fallback: DEFAULT_INVITATION_MESSAGE,
				},
				{
					label: 'recordatorio',
					message: sharing.reminder,
					fallback: DEFAULT_REMINDER_MESSAGE,
				},
			].map(({ label, message, fallback }) => (
				<div key={label} className="invitation-editor__preview-section">
					<span className="invitation-editor__preview-label">
						Vista previa — {label}:
					</span>
					<pre className="invitation-editor__preview-text">
						{renderShareMessage(message ?? fallback, sharingPreviewContext)}
					</pre>
				</div>
			))}
			<p className="invitation-editor__helper-text">
				Variables disponibles:{' '}
				{SHARE_MESSAGE_VARIABLES.map((v: string) => (
					<code
						key={v}
						className="invitation-editor__variable"
						title={
							SHARE_MESSAGE_VARIABLE_LABELS[
								v as keyof typeof SHARE_MESSAGE_VARIABLE_LABELS
							]
						}
					>
						{v}
					</code>
				))}
			</p>
			{sharingResetConfirm.pending ? (
				<div className="invitation-editor__reset-confirm">
					<span className="invitation-editor__reset-confirm-text">
						¿Restablecer valores predeterminados?
					</span>
					<button
						type="button"
						className="invitation-editor__secondary-button invitation-editor__secondary-button--danger"
						onClick={sharingResetConfirm.confirm}
					>
						Confirmar
					</button>
					<button
						type="button"
						className="invitation-editor__secondary-button"
						onClick={sharingResetConfirm.cancel}
					>
						Cancelar
					</button>
				</div>
			) : (
				<button
					type="button"
					className="invitation-editor__secondary-button"
					onClick={sharingResetConfirm.request}
				>
					Restablecer valores predeterminados
				</button>
			)}
		</SectionCard>
	);
}
