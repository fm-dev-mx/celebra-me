import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

const RsvpConfigBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;
	const getNumber = (key: string, fallback = 0) => {
		const v = data[key];
		return typeof v === 'number' ? v : fallback;
	};

	return (
		<div className="intake-block intake-block--rsvp-config">
			<h3 className="intake-block__title">Confirmacion de asistencia (RSVP)</h3>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="title">
					Titulo de la seccion RSVP <span className="intake-field__required">*</span>
				</label>
				<input
					id="title"
					type="text"
					className="intake-field__input"
					value={getValue('title')}
					onChange={(e) => onChange('title', e.target.value)}
					placeholder="Confirma tu asistencia"
					disabled={disabled}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="guestCap">
					Capacidad de invitados (por pase){' '}
					<span className="intake-field__required">*</span>
				</label>
				<input
					id="guestCap"
					type="number"
					className="intake-field__input"
					value={getNumber('guestCap') || ''}
					onChange={(e) => onChange('guestCap', Number.parseInt(e.target.value, 10) || 0)}
					min={1}
					max={20}
					disabled={disabled}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="confirmationMessage">
					Mensaje de confirmacion <span className="intake-field__required">*</span>
				</label>
				<textarea
					id="confirmationMessage"
					className="intake-field__textarea"
					value={getValue('confirmationMessage')}
					onChange={(e) => onChange('confirmationMessage', e.target.value)}
					placeholder="Tu asistencia ha sido confirmada..."
					disabled={disabled}
					rows={3}
					required
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="confirmationMode">
					Modo de confirmacion <span className="intake-field__required">*</span>
				</label>
				<select
					id="confirmationMode"
					className="intake-field__select"
					value={getValue('confirmationMode', 'api')}
					onChange={(e) => onChange('confirmationMode', e.target.value)}
					disabled={disabled}
				>
					<option value="api">Formulario en linea</option>
					<option value="whatsapp">WhatsApp</option>
					<option value="both">Ambos</option>
				</select>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="whatsappPhone">
					Telefono de WhatsApp
				</label>
				<input
					id="whatsappPhone"
					type="text"
					className="intake-field__input"
					value={getValue('whatsappPhone')}
					onChange={(e) => onChange('whatsappPhone', e.target.value)}
					placeholder="+52 1234567890"
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="subcopy">
					Texto adicional
				</label>
				<textarea
					id="subcopy"
					className="intake-field__textarea"
					value={getValue('subcopy')}
					onChange={(e) => onChange('subcopy', e.target.value)}
					disabled={disabled}
					rows={2}
				/>
			</div>
		</div>
	);
};

export default RsvpConfigBlock;
