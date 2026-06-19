/* eslint-disable complexity -- form with many fields */
import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';

interface RsvpValue {
	title?: string;
	guestCap?: number;
	confirmationMessage?: string;
	confirmationMode?: string;
	whatsappPhone?: string;
	subcopy?: string;
	confirmationDeadline?: string;
	responseMessages?: {
		confirmed?: { title?: string; subtitle?: string };
		declined?: { title?: string; subtitle?: string };
	};
}

interface Props {
	value: RsvpValue;
	onChange: (patch: Partial<RsvpValue>) => void;
	onChangeResponseMessage: (
		status: 'confirmed' | 'declined',
		field: 'title' | 'subtitle',
		value: string,
	) => void;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	visible?: boolean;
}

export default function RsvpSectionEditor({
	value: rsvp,
	onChange: updateRsvp,
	onChangeResponseMessage: updateRsvpResponseMessage,
	dirty,
	error,
	success,
	sourceBadge,
	visible,
}: Props) {
	return (
		<SectionCard
			id="rsvp"
			title="Confirmación de asistencia"
			description="Configuración visible para invitados; las respuestas permanecen separadas."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<div className="invitation-editor__field-grid">
				<Field
					label="Título"
					value={rsvp.title ?? ''}
					onChange={(value) => updateRsvp({ title: value })}
					labelExtra={
						<TextPresetPicker
							section="rsvpTitle"
							onSelect={(value) => updateRsvp({ title: value })}
						/>
					}
				/>
				<Field
					label="Máximo de acompañantes"
					type="number"
					value={String(rsvp.guestCap ?? '')}
					onChange={(value) =>
						updateRsvp({ guestCap: value ? Number(value) : undefined })
					}
				/>
				<label className="invitation-editor__field">
					<span>Modo de confirmación</span>
					<select
						value={rsvp.confirmationMode ?? 'api'}
						onChange={(event) => updateRsvp({ confirmationMode: event.target.value })}
					>
						<option value="api">Formulario</option>
						<option value="whatsapp">WhatsApp</option>
						<option value="both">Formulario y WhatsApp</option>
					</select>
				</label>
				{['whatsapp', 'both'].includes(rsvp.confirmationMode ?? '') && (
					<Field
						label="WhatsApp"
						value={rsvp.whatsappPhone ?? ''}
						onChange={(value) => updateRsvp({ whatsappPhone: value })}
					/>
				)}
			</div>
			<TextArea
				label="Mensaje de confirmación"
				value={rsvp.confirmationMessage ?? ''}
				onChange={(value) => updateRsvp({ confirmationMessage: value })}
				labelExtra={
					<TextPresetPicker
						section="rsvpMessage"
						onSelect={(value) => updateRsvp({ confirmationMessage: value })}
					/>
				}
			/>
			<TextArea
				label="Texto secundario"
				value={rsvp.subcopy ?? ''}
				onChange={(value) => updateRsvp({ subcopy: value })}
			/>
			<Field
				label="Fecha límite de confirmación"
				placeholder="15 de marzo de 2026"
				value={rsvp.confirmationDeadline ?? ''}
				onChange={(value) => updateRsvp({ confirmationDeadline: value })}
			/>
			<p className="invitation-editor__helper-text">
				Disponible como {'{rsvpDeadline}'} y {'{rsvpDeadlineText}'} en los mensajes para
				compartir.
			</p>
			<details className="invitation-editor__row-details">
				<summary>Mensajes de respuesta</summary>
				<div className="invitation-editor__stack">
					<p className="invitation-editor__hint">
						Variables disponibles: {`{guestName}`}, {`{celebrantName}`}
					</p>
					<Field
						label="Mensaje al confirmar"
						value={rsvp.responseMessages?.confirmed?.title ?? ''}
						onChange={(value) => updateRsvpResponseMessage('confirmed', 'title', value)}
						placeholder="¡Gracias por acompañarnos, {guestName}!"
					/>
					<TextArea
						label="Subtítulo al confirmar"
						value={rsvp.responseMessages?.confirmed?.subtitle ?? ''}
						onChange={(value) =>
							updateRsvpResponseMessage('confirmed', 'subtitle', value)
						}
						placeholder="Tu confirmación ha sido registrada."
					/>
					<Field
						label="Mensaje al declinar"
						value={rsvp.responseMessages?.declined?.title ?? ''}
						onChange={(value) => updateRsvpResponseMessage('declined', 'title', value)}
						placeholder="Sentimos mucho que no puedas acompañarnos, {guestName}."
					/>
					<TextArea
						label="Subtítulo al declinar"
						value={rsvp.responseMessages?.declined?.subtitle ?? ''}
						onChange={(value) =>
							updateRsvpResponseMessage('declined', 'subtitle', value)
						}
						placeholder="Gracias por avisarnos."
					/>
				</div>
			</details>
		</SectionCard>
	);
}
