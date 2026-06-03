import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import type { EditableAssetSource } from '@/lib/assets/asset-source';

type AssetField = string | EditableAssetSource;

interface VenueData {
	venueName?: string;
	address?: string;
	city?: string;
	date?: string;
	time?: string;
	mapUrl?: string;
	image?: AssetField;
}

interface LocationData {
	ceremony?: VenueData;
	reception?: VenueData;
	dressCode?: string;
	additionalIndications?: string;
}

interface Props {
	location: LocationData;
	dirty: boolean;
	saving: boolean;
	error?: string;
	success?: string;
	onSave: () => void;
	sourceBadge?: { source: string; label: string };
	onUpdateLocation: (patch: Partial<LocationData>) => void;
	onOpenAssetPicker: (field: string) => void;
}

export default function LocationSectionEditor({
	location,
	dirty,
	saving,
	error,
	success,
	onSave,
	sourceBadge,
	onUpdateLocation,
	onOpenAssetPicker,
}: Props) {
	return (
		<SectionCard
			id="location"
			title="Fecha y ubicaciones"
			description="Ceremonia, recepción e indicaciones."
			dirty={dirty}
			saving={saving}
			error={error}
			success={success}
			onSave={onSave}
			sourceBadge={sourceBadge}
		>
			{(['ceremony', 'reception'] as const).map((venueKey) => {
				const venue = location[venueKey] ?? {};
				const updateVenue = (patch: Partial<VenueData>) =>
					onUpdateLocation({ [venueKey]: { ...venue, ...patch } });
				return (
					<div className="invitation-editor__subsection" key={venueKey}>
						<h3>{venueKey === 'ceremony' ? 'Ceremonia' : 'Recepción'}</h3>
						<div className="invitation-editor__field-grid">
							<Field
								label="Lugar"
								value={venue.venueName ?? ''}
								onChange={(value) => updateVenue({ venueName: value })}
							/>
							<Field
								label="Dirección"
								value={venue.address ?? ''}
								onChange={(value) => updateVenue({ address: value })}
							/>
							<Field
								label="Ciudad"
								value={venue.city ?? ''}
								onChange={(value) => updateVenue({ city: value })}
							/>
							<Field
								label="Fecha"
								type="date"
								value={venue.date ?? ''}
								onChange={(value) => updateVenue({ date: value })}
							/>
							<Field
								label="Hora"
								type="time"
								value={venue.time ?? ''}
								onChange={(value) => updateVenue({ time: value })}
							/>
							<Field
								label="Mapa"
								type="url"
								value={venue.mapUrl ?? ''}
								onChange={(value) => updateVenue({ mapUrl: value })}
							/>
						</div>
						<label className="invitation-editor__field">
							<span>Imagen del lugar</span>
							<button
								type="button"
								className="invitation-editor__asset-btn"
								onClick={() => onOpenAssetPicker(`location.${venueKey}.image`)}
							>
								{venue.image ? 'Cambiar imagen' : 'Seleccionar imagen'}
							</button>
						</label>
					</div>
				);
			})}
			<Field
				label="Código de vestimenta"
				value={location.dressCode ?? ''}
				onChange={(value) => onUpdateLocation({ dressCode: value })}
				labelExtra={
					<TextPresetPicker
						section="dressCode"
						onSelect={(value) => onUpdateLocation({ dressCode: value })}
					/>
				}
			/>
			<TextArea
				label="Indicaciones adicionales"
				value={location.additionalIndications ?? ''}
				onChange={(value) => onUpdateLocation({ additionalIndications: value })}
			/>
		</SectionCard>
	);
}
