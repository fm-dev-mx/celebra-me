import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { getFieldLabel } from '@/lib/intake/labels';
import type { FamilyDraft, FamilyGroupDraft } from '@/lib/intake/schemas/family-draft.schema';

type FamilyData = FamilyDraft;

interface Props {
	family: FamilyData;
	eventType: string;
	invitationId: string;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateFamily: (patch: Partial<FamilyData>) => void;
	onOpenAssetPicker: (field: 'family.featuredImage') => void;
	assetLookupSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
}

function SectionCopyFields({
	family,
	eventType,
	onUpdateFamily,
}: {
	family: FamilyData;
	eventType: string;
	onUpdateFamily: (patch: Partial<FamilyData>) => void;
}) {
	const isBoda = eventType === 'boda';
	return (
		<details className="invitation-editor__row-details">
			<summary>Textos de sección</summary>
			<div className="invitation-editor__field-grid">
				<Field
					label="Encabezado de sección"
					placeholder="Mi Familia"
					value={family.sectionSubtitle ?? ''}
					onChange={(value) => onUpdateFamily({ sectionSubtitle: value })}
				/>
				<Field
					label="Título de sección"
					placeholder="Los que hacen mi vida completa"
					value={family.sectionTitle ?? ''}
					onChange={(value) => onUpdateFamily({ sectionTitle: value })}
				/>
				<Field
					label="Título de padres"
					placeholder="Con la bendición de"
					value={family.parentsTitle ?? ''}
					onChange={(value) => onUpdateFamily({ parentsTitle: value })}
				/>
				<Field
					label="Título de padrinos"
					placeholder="Padrinos"
					value={family.godparentsTitle ?? ''}
					onChange={(value) => onUpdateFamily({ godparentsTitle: value })}
				/>
				{isBoda && (
					<>
						<Field
							label="Título de cónyuge"
							placeholder="Mi Compañera de Vida"
							value={family.spouseTitle ?? ''}
							onChange={(value) => onUpdateFamily({ spouseTitle: value })}
						/>
						<Field
							label="Rol de cónyuge"
							placeholder="Esposa"
							value={family.spouseRole ?? ''}
							onChange={(value) => onUpdateFamily({ spouseRole: value })}
						/>
						<Field
							label="Título de hijos"
							placeholder="Nuestros Hijos"
							value={family.childrenTitle ?? ''}
							onChange={(value) => onUpdateFamily({ childrenTitle: value })}
						/>
					</>
				)}
			</div>
		</details>
	);
}

function GroupsEditor({
	groups,
	onUpdateFamily,
}: {
	groups: FamilyGroupDraft[];
	onUpdateFamily: (patch: Partial<FamilyData>) => void;
}) {
	const updateGroup = (index: number, patch: Partial<FamilyGroupDraft>) => {
		const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
		onUpdateFamily({ groups: next });
	};

	return (
		<div className="invitation-editor__stack">
			<strong>Grupos adicionales</strong>
			<p className="invitation-editor__helper-text">
				Usa grupos para padres de la novia, padrinos, abuelos u otros familiares. Cada
				nombre en una línea separada.
			</p>
			{groups.map((group, index) => (
				<div className="invitation-editor__list-item" key={`group-${index}`}>
					<div className="invitation-editor__compact-row">
						<strong>Grupo {index + 1}</strong>
						<button
							type="button"
							className="invitation-editor__link-button"
							onClick={() =>
								onUpdateFamily({
									groups: groups.filter((_, i) => i !== index),
								})
							}
						>
							Eliminar grupo
						</button>
					</div>
					<div className="invitation-editor__field-grid">
						<Field
							label="Título del grupo"
							placeholder="Padrinos"
							value={group.title ?? ''}
							onChange={(value) => updateGroup(index, { title: value })}
						/>
					</div>
					<TextArea
						label="Nombres (uno por línea)"
						value={group.names ?? ''}
						onChange={(value) => updateGroup(index, { names: value })}
					/>
				</div>
			))}
			<button
				type="button"
				className="invitation-editor__secondary-button"
				onClick={() =>
					onUpdateFamily({
						groups: [...groups, { title: '', names: '' }],
					})
				}
			>
				Agregar grupo
			</button>
		</div>
	);
}

export default function FamilySectionEditor({
	family,
	eventType,
	invitationId,
	dirty,
	error,
	success,
	sourceBadge,
	onUpdateFamily,
	onOpenAssetPicker,
	assetLookupSlug,
	assets,
	visible = true,
}: Props) {
	const isBoda = eventType === 'boda';
	const groups = family.groups ?? [];

	return (
		<SectionCard
			id="family"
			title="Personas principales"
			description="Familia y personas destacadas."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<label className="invitation-editor__check">
				<input
					type="checkbox"
					checked={family.visible !== false}
					onChange={(event) => onUpdateFamily({ visible: event.target.checked })}
				/>
				<span>Mostrar sección de familia</span>
			</label>

			<SectionCopyFields
				family={family}
				eventType={eventType}
				onUpdateFamily={onUpdateFamily}
			/>

			<div className="invitation-editor__field-grid">
				<Field
					label={getFieldLabel('family', 'fatherName', eventType)}
					value={family.fatherName ?? ''}
					onChange={(value) => onUpdateFamily({ fatherName: value })}
				/>
				<Field
					label={getFieldLabel('family', 'motherName', eventType)}
					value={family.motherName ?? ''}
					onChange={(value) => onUpdateFamily({ motherName: value })}
				/>
				{isBoda && (
					<Field
						label={getFieldLabel('family', 'spouseName', eventType)}
						value={family.spouseName ?? ''}
						onChange={(value) => onUpdateFamily({ spouseName: value })}
					/>
				)}
			</div>
			<label className="invitation-editor__check">
				<input
					type="checkbox"
					checked={family.fatherDeceased ?? false}
					onChange={(event) => onUpdateFamily({ fatherDeceased: event.target.checked })}
				/>
				<span>Mostrar cruz junto al nombre del papá</span>
			</label>
			<label className="invitation-editor__check">
				<input
					type="checkbox"
					checked={family.motherDeceased ?? false}
					onChange={(event) => onUpdateFamily({ motherDeceased: event.target.checked })}
				/>
				<span>Mostrar cruz junto al nombre de la mamá</span>
			</label>
			<TextArea
				label={getFieldLabel('family', 'godparents', eventType)}
				value={family.godparents ?? ''}
				onChange={(value) => onUpdateFamily({ godparents: value })}
			/>
			{isBoda && (
				<TextArea
					label={getFieldLabel('family', 'children', eventType)}
					value={family.children ?? ''}
					onChange={(value) => onUpdateFamily({ children: value })}
				/>
			)}

			<GroupsEditor groups={groups} onUpdateFamily={onUpdateFamily} />

			<TextArea
				label={getFieldLabel('family', 'sectionMessage', eventType)}
				value={family.sectionMessage ?? ''}
				onChange={(value) => onUpdateFamily({ sectionMessage: value })}
				labelExtra={
					<TextPresetPicker
						section="familyMessage"
						eventType={eventType}
						onSelect={(value) => onUpdateFamily({ sectionMessage: value })}
					/>
				}
			/>
			{invitationId && (
				<ImageAssetField
					label="Imagen familiar"
					value={family.featuredImage}
					assetLookupSlug={assetLookupSlug}
					assets={assets}
					onOpenLibrary={() => onOpenAssetPicker('family.featuredImage')}
				/>
			)}
		</SectionCard>
	);
}
