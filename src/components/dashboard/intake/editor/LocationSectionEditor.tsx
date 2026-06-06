import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import IconPickerField from '@/components/dashboard/intake/editor/IconPickerField';
import { DEFAULT_ICON, isIconName, type IconName } from '@/lib/icons/icon-catalog';
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

interface DraftIndication {
	iconName: IconName;
	text: string;
}

interface LocationData {
	introEyebrow?: string;
	introHeading?: string;
	introLede?: string;
	indicationsHeading?: string;
	ceremony?: VenueData;
	reception?: VenueData;
	indications?: DraftIndication[];
}

interface Props {
	location: LocationData;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateLocation: (patch: Partial<LocationData>) => void;
	onOpenAssetPicker: (field: `location.${'ceremony' | 'reception'}.image`) => void;
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
	const indications = location.indications ?? [];

	const updateIndication = (index: number, patch: Partial<DraftIndication>) => {
		const updated = indications.map((item, i) => (i === index ? { ...item, ...patch } : item));
		onUpdateLocation({ indications: updated });
	};

	const removeIndication = (index: number) => {
		onUpdateLocation({ indications: indications.filter((_, i) => i !== index) });
	};

	const addIndication = () => {
		onUpdateLocation({
			indications: [...indications, { iconName: DEFAULT_ICON, text: '' }],
		});
	};

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
			<div className="invitation-editor__section-group">
				<h3>Texto de la sección</h3>
				<div className="invitation-editor__field-grid">
					<Field
						label="Texto superior"
						value={location.introEyebrow ?? ''}
						onChange={(value) => onUpdateLocation({ introEyebrow: value })}
					/>
					<Field
						label="Título de sección"
						value={location.introHeading ?? ''}
						onChange={(value) => onUpdateLocation({ introHeading: value })}
					/>
				</div>
				<TextArea
					label="Descripción de sección"
					value={location.introLede ?? ''}
					onChange={(value) => onUpdateLocation({ introLede: value })}
				/>
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
				<h3>Indicaciones</h3>
				<Field
					label="Título de indicaciones"
					value={location.indicationsHeading ?? ''}
					onChange={(value) => onUpdateLocation({ indicationsHeading: value })}
				/>
				<div className="invitation-editor__stack">
					{indications.map((indication, index) => (
						<article
							className="invitation-editor__list-item"
							key={`${index}-${indication.iconName}`}
						>
							<div className="invitation-editor__compact-row">
								<strong>
									{index + 1}. {indication.text || 'Sin texto'}
								</strong>
								<div className="invitation-editor__reorder">
									<button type="button" onClick={() => removeIndication(index)}>
										Eliminar
									</button>
								</div>
							</div>
							<details className="invitation-editor__row-details">
								<summary>Editar indicación</summary>
								<div className="invitation-editor__field-grid">
									<IconPickerField
										label="Icono"
										value={
											isIconName(indication.iconName)
												? indication.iconName
												: null
										}
										onChange={(iconName) =>
											updateIndication(index, {
												iconName: (iconName ?? DEFAULT_ICON) as IconName,
											})
										}
									/>
									<label className="invitation-editor__field">
										<span>Texto</span>
										<input
											value={indication.text}
											onChange={(event) =>
												updateIndication(index, {
													text: event.target.value,
												})
											}
										/>
									</label>
								</div>
							</details>
						</article>
					))}
				</div>
				<button
					className="invitation-editor__secondary-button"
					type="button"
					onClick={addIndication}
				>
					Agregar indicación
				</button>
			</div>
		</SectionCard>
	);
}
