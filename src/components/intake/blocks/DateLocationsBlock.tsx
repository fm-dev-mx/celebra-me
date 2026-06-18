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
	googleMapsUrl?: string;
	appleMapsUrl?: string;
	wazeUrl?: string;
	coordinates?: { lat: string; lng: string };
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
				<label className="intake-field__label">Enlace genérico del mapa</label>
				<input
					type="url"
					className="intake-field__input"
					value={venue.mapUrl ?? ''}
					onChange={(e) => updateVenue(venueKey, 'mapUrl', e.target.value)}
					disabled={disabled}
					placeholder="https://maps.google.com/..."
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Google Maps</label>
				<input
					type="url"
					className="intake-field__input"
					value={venue.googleMapsUrl ?? ''}
					onChange={(e) => updateVenue(venueKey, 'googleMapsUrl', e.target.value)}
					disabled={disabled}
					placeholder="https://maps.google.com/..."
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Apple Maps</label>
				<input
					type="url"
					className="intake-field__input"
					value={venue.appleMapsUrl ?? ''}
					onChange={(e) => updateVenue(venueKey, 'appleMapsUrl', e.target.value)}
					disabled={disabled}
					placeholder="https://maps.apple.com/..."
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Waze</label>
				<input
					type="url"
					className="intake-field__input"
					value={venue.wazeUrl ?? ''}
					onChange={(e) => updateVenue(venueKey, 'wazeUrl', e.target.value)}
					disabled={disabled}
					placeholder="https://waze.com/ul?..."
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Latitud</label>
				<input
					type="number"
					step="any"
					inputMode="decimal"
					className="intake-field__input"
					value={venue.coordinates?.lat ?? ''}
					onChange={(e) => {
						const current = getVenue(data, venueKey);
						onChange(venueKey, {
							...current,
							coordinates: {
								lat: e.target.value,
								lng: current.coordinates?.lng ?? '',
							},
						});
					}}
					disabled={disabled}
					placeholder="19.4326"
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label">Longitud</label>
				<input
					type="number"
					step="any"
					inputMode="decimal"
					className="intake-field__input"
					value={venue.coordinates?.lng ?? ''}
					onChange={(e) => {
						const current = getVenue(data, venueKey);
						onChange(venueKey, {
							...current,
							coordinates: {
								lng: e.target.value,
								lat: current.coordinates?.lat ?? '',
							},
						});
					}}
					disabled={disabled}
					placeholder="-99.1332"
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
