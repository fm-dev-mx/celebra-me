import type { InvitationEditorMetadata } from '@/lib/dashboard/dto/intake';
import { INVITATION_STATUS_LABELS } from '@/lib/intake/labels';
import { INVITATION_STATUSES, type InvitationStatus } from '@/lib/intake/types';

interface Props {
	value: InvitationEditorMetadata;
	onChange: (value: InvitationEditorMetadata) => void;
}

export default function MetadataSection({ value, onChange }: Props) {
	const set = <Key extends keyof InvitationEditorMetadata>(
		key: Key,
		nextValue: InvitationEditorMetadata[Key],
	) => {
		onChange({ ...value, [key]: nextValue });
	};

	return (
		<div className="invitation-editor__field-grid">
			<label className="invitation-editor__field">
				<span>Título administrativo</span>
				<input value={value.title} onChange={(event) => set('title', event.target.value)} />
			</label>
			<label className="invitation-editor__field">
				<span>Slug público</span>
				<input
					placeholder="mi-invitacion"
					value={value.slug ?? ''}
					onChange={(event) => set('slug', event.target.value || null)}
				/>
			</label>
			<label className="invitation-editor__field">
				<span>Nombre del cliente</span>
				<input
					value={value.clientName}
					onChange={(event) => set('clientName', event.target.value)}
				/>
			</label>
			<label className="invitation-editor__field">
				<span>Correo del cliente</span>
				<input
					type="email"
					value={value.clientEmail}
					onChange={(event) => set('clientEmail', event.target.value)}
				/>
			</label>
			<label className="invitation-editor__field">
				<span>WhatsApp del cliente</span>
				<input
					value={value.clientWhatsapp}
					onChange={(event) => set('clientWhatsapp', event.target.value)}
				/>
			</label>
			<label className="invitation-editor__field">
				<span>Estado administrativo</span>
				<select
					value={value.status}
					onChange={(event) => set('status', event.target.value as InvitationStatus)}
				>
					{INVITATION_STATUSES.map((status) => (
						<option key={status} value={status}>
							{INVITATION_STATUS_LABELS[status]}
						</option>
					))}
				</select>
			</label>
			<label className="invitation-editor__check">
				<input
					type="checkbox"
					checked={value.photosReceived}
					onChange={(event) => set('photosReceived', event.target.checked)}
				/>
				<span>Fotos recibidas por WhatsApp</span>
			</label>
		</div>
	);
}
