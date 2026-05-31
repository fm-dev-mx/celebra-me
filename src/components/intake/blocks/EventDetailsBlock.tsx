import type { FC } from 'react';
import type { EventType } from '@/lib/theme/theme-contract';
import { getVisibleFields } from '@/lib/intake/blocks';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
	eventType: EventType;
}

const EventDetailsBlock: FC<Props> = ({ data, onChange, disabled, eventType }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;
	const visibleFields = new Set(getVisibleFields(eventType, 'event-details').map((f) => f.name));

	return (
		<div className="intake-block intake-block--event-details">
			<h3 className="intake-block__title">Detalles del evento</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="celebrantName">
					Nombre del festejado(a) <span className="intake-field__required">*</span>
				</label>
				<input
					id="celebrantName"
					type="text"
					className="intake-field__input"
					value={getValue('celebrantName')}
					onChange={(e) => onChange('celebrantName', e.target.value)}
					placeholder="Isabella Rose Valenzuela"
					disabled={disabled}
					required
				/>
			</div>

			{visibleFields.has('secondaryName') && (
				<div className="intake-field">
					<label className="intake-field__label" htmlFor="secondaryName">
						Nombre adicional (para bodas)
					</label>
					<input
						id="secondaryName"
						type="text"
						className="intake-field__input"
						value={getValue('secondaryName')}
						onChange={(e) => onChange('secondaryName', e.target.value)}
						placeholder="Segundo nombre o nombre de pareja"
						disabled={disabled}
					/>
				</div>
			)}

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="eventLabel">
					Etiqueta del evento <span className="intake-field__required">*</span>
				</label>
				<input
					id="eventLabel"
					type="text"
					className="intake-field__input"
					value={getValue('eventLabel')}
					onChange={(e) => onChange('eventLabel', e.target.value)}
					placeholder="Mis XV Años"
					disabled={disabled}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="eventDate">
					Fecha del evento <span className="intake-field__required">*</span>
				</label>
				<input
					id="eventDate"
					type="date"
					className="intake-field__input"
					value={getValue('eventDate')}
					onChange={(e) => onChange('eventDate', e.target.value)}
					disabled={disabled}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="eventTitle">
					Título de la invitación <span className="intake-field__required">*</span>
				</label>
				<input
					id="eventTitle"
					type="text"
					className="intake-field__input"
					value={getValue('eventTitle')}
					onChange={(e) => onChange('eventTitle', e.target.value)}
					placeholder="Mis XV Años"
					disabled={disabled}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="description">
					Descripción breve (para redes sociales)
				</label>
				<textarea
					id="description"
					className="intake-field__textarea"
					value={getValue('description')}
					onChange={(e) => onChange('description', e.target.value)}
					placeholder="Acompananos a celebrar..."
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="nickname">
					Apodo o frase corta
				</label>
				<input
					id="nickname"
					type="text"
					className="intake-field__input"
					value={getValue('nickname')}
					onChange={(e) => onChange('nickname', e.target.value)}
					disabled={disabled}
				/>
			</div>
		</div>
	);
};

export default EventDetailsBlock;
