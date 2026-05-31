import type { FC } from 'react';
import type { EventType } from '@/lib/theme/theme-contract';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
	eventType: EventType;
}

interface VenueData {
	venueName?: string;
	address?: string;
	city?: string;
	date?: string;
	time?: string;
	mapUrl?: string;
}

function getVenue(data: Record<string, unknown>, key: string): VenueData {
	return (data[key] as VenueData) ?? {};
}

const DateLocationsBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const ceremony = getVenue(data, 'ceremony');
	const reception = getVenue(data, 'reception');
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;

	const updateVenue = (venueKey: string, field: string, value: string) => {
		const current = getVenue(data, venueKey);
		onChange(venueKey, { ...current, [field]: value });
	};

	const renderVenueFields = (label: string, venueKey: string, venue: VenueData) => (
		<fieldset className="intake-block__venue-group">
			<legend className="intake-block__venue-legend">{label}</legend>

			<div className="intake-field">
				<label className="intake-field__label">Nombre del lugar</label>
				<input
					type="text"
					className="intake-field__input"
					value={venue.venueName ?? ''}
					onChange={(e) => updateVenue(venueKey, 'venueName', e.target.value)}
					disabled={disabled}
					placeholder="Parroquia de San Jose"
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Dirección</label>
				<input
					type="text"
					className="intake-field__input"
					value={venue.address ?? ''}
					onChange={(e) => updateVenue(venueKey, 'address', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Ciudad</label>
				<input
					type="text"
					className="intake-field__input"
					value={venue.city ?? ''}
					onChange={(e) => updateVenue(venueKey, 'city', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Fecha</label>
				<input
					type="date"
					className="intake-field__input"
					value={venue.date ?? ''}
					onChange={(e) => updateVenue(venueKey, 'date', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Hora</label>
				<input
					type="time"
					className="intake-field__input"
					value={venue.time ?? ''}
					onChange={(e) => updateVenue(venueKey, 'time', e.target.value)}
					disabled={disabled}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">URL del mapa</label>
				<input
					type="url"
					className="intake-field__input"
					value={venue.mapUrl ?? ''}
					onChange={(e) => updateVenue(venueKey, 'mapUrl', e.target.value)}
					disabled={disabled}
					placeholder="https://maps.google.com/..."
				/>
			</div>
		</fieldset>
	);

	return (
		<div className="intake-block intake-block--date-locations">
			<h3 className="intake-block__title">Fecha y ubicaciones</h3>

			{renderVenueFields('Ceremonia', 'ceremony', ceremony)}
			{renderVenueFields('Recepción', 'reception', reception)}

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="dressCode">
					Código de vestimenta
				</label>
				<input
					id="dressCode"
					type="text"
					className="intake-field__input"
					value={getValue('dressCode')}
					onChange={(e) => onChange('dressCode', e.target.value)}
					disabled={disabled}
					placeholder="Formal / Etiqueta"
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="additionalIndications">
					Indicaciones adicionales
				</label>
				<textarea
					id="additionalIndications"
					className="intake-field__textarea"
					value={getValue('additionalIndications')}
					onChange={(e) => onChange('additionalIndications', e.target.value)}
					disabled={disabled}
					rows={3}
				/>
			</div>
		</div>
	);
};

export default DateLocationsBlock;
