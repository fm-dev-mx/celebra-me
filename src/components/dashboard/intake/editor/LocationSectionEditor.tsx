import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type { AssetField } from '@/lib/assets/asset-source';
import type { AssetItem } from '@/lib/intake/use-asset-library';

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
	introEyebrow?: string;
	introHeading?: string;
	introLede?: string;
	indicationsHeading?: string;
	ceremony?: VenueData;
	reception?: VenueData;
	dressCode?: string;
	additionalIndications?: string;
}

interface Props {
	location: LocationData;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateLocation: (patch: Partial<LocationData>) => void;
	onOpenAssetPicker: (field: string) => void;
	assetLookupSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
}

export default function LocationSectionEditor({
	location,
	dirty,
	error,
	success,
	sourceBadge,
	onUpdateLocation,
	onOpenAssetPicker,
	assetLookupSlug,
	assets,
	visible = true,
}: Props) {
	return (
		<SectionCard
			id="location"
			title="Fecha y ubicaciones"
			description="Ceremonia, recepción e indicaciones."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<div className="invitation-editor__section-copy">
				<div className="invitation-editor__section-group">
					<h3>Texto de la sección</h3>
					<p className="invitation-editor__helper-text">
						Estos textos aparecen en la parte superior de la sección. Puedes
						personalizarlos para dar contexto a tus invitados.
					</p>
					<div className="invitation-editor__field-grid">
						<Field
							label="Texto superior"
							placeholder="Ej: El camino al palacio"
							value={location.introEyebrow ?? ''}
							onChange={(value) => onUpdateLocation({ introEyebrow: value })}
						/>
						<Field
							label="Título de sección"
							placeholder="Ej: Ubicación"
							value={location.introHeading ?? ''}
							onChange={(value) => onUpdateLocation({ introHeading: value })}
						/>
					</div>
					<TextArea
						label="Descripción de sección"
						placeholder="Ej: Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas."
						value={location.introLede ?? ''}
						onChange={(value) => onUpdateLocation({ introLede: value })}
					/>
				</div>
			</div>
			{(['ceremony', 'reception'] as const).map((venueKey) => {
				const venue = location[venueKey] ?? {};
				const updateVenue = (patch: Partial<VenueData>) =>
					onUpdateLocation({ [venueKey]: { ...venue, ...patch } });
				return (
					<div className="invitation-editor__subsection" key={venueKey}>
						<h3>{venueKey === 'ceremony' ? 'Ceremonia' : 'Recepción'}</h3>
						<div className="invitation-editor__section-group">
							<h4>Datos principales</h4>
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
						</div>
						<div className="invitation-editor__section-group">
							<h4>Imagen del lugar</h4>
							<ImageAssetField
								label="Imagen del lugar"
								value={venue.image}
								assetLookupSlug={assetLookupSlug}
								assets={assets}
								onOpenLibrary={() =>
									onOpenAssetPicker(`location.${venueKey}.image`)
								}
							/>
						</div>
					</div>
				);
			})}
			<div className="invitation-editor__section-group">
				<h3>Detalles adicionales</h3>
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
				<Field
					label="Título de indicaciones"
					value={location.indicationsHeading ?? ''}
					onChange={(value) => onUpdateLocation({ indicationsHeading: value })}
				/>
			</div>
		</SectionCard>
	);
}
