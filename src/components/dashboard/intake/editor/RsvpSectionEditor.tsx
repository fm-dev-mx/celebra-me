/* eslint-disable complexity -- form with many fields */
import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import { RSVP_GUEST_CAP_MIN, RSVP_GUEST_CAP_TECHNICAL_MAX } from '@/lib/rsvp/guest-cap';

interface RsvpValue {
	title?: string;
	guestCap?: number;
	confirmationMessage?: string;
	confirmationMode?: string;
	whatsappPhone?: string;
	subcopy?: string;
	confirmationDeadline?: string;
	accessMode?: 'personalized-only' | 'hybrid';
	personalizedAccess?: { title?: string; subtitle?: string; footerText?: string };
	calendar?: { title?: string; description?: string; startsAt?: string };
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
					label="Máximo de asistentes por confirmación"
					type="number"
					value={String(rsvp.guestCap ?? '')}
					min={RSVP_GUEST_CAP_MIN}
					max={RSVP_GUEST_CAP_TECHNICAL_MAX}
					onChange={(value) =>
						updateRsvp({ guestCap: value ? Number(value) : undefined })
					}
				/>
				<p className="invitation-editor__helper-text">
					Incluye a la persona principal y a todos sus acompañantes en una misma
					confirmación.
				</p>
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
				<label className="invitation-editor__field">
					<span>Acceso de invitados</span>
					<select
						value={rsvp.accessMode ?? 'personalized-only'}
						onChange={(event) =>
							updateRsvp({
								accessMode: event.target.value as 'personalized-only' | 'hybrid',
							})
						}
					>
						<option value="personalized-only">Solo acceso personalizado</option>
						<option value="hybrid">Acceso personalizado y público</option>
					</select>
				</label>
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
				<summary>Acceso personalizado y calendario</summary>
				<div className="invitation-editor__stack">
					<Field label="Título de acceso" value={rsvp.personalizedAccess?.title ?? ''} onChange={(value) => updateRsvp({ personalizedAccess: { ...rsvp.personalizedAccess, title: value } })} />
					<TextArea label="Texto de acceso" value={rsvp.personalizedAccess?.subtitle ?? ''} onChange={(value) => updateRsvp({ personalizedAccess: { ...rsvp.personalizedAccess, subtitle: value } })} />
					<TextArea label="Texto final de acceso" value={rsvp.personalizedAccess?.footerText ?? ''} onChange={(value) => updateRsvp({ personalizedAccess: { ...rsvp.personalizedAccess, footerText: value } })} />
					<Field label="Título del calendario" value={rsvp.calendar?.title ?? ''} onChange={(value) => updateRsvp({ calendar: { ...rsvp.calendar, title: value } })} />
					<TextArea label="Descripción del calendario" value={rsvp.calendar?.description ?? ''} onChange={(value) => updateRsvp({ calendar: { ...rsvp.calendar, description: value } })} />
					<Field label="Inicio del calendario" value={rsvp.calendar?.startsAt ?? ''} onChange={(value) => updateRsvp({ calendar: { ...rsvp.calendar, startsAt: value } })} />
				</div>
			</details>
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
