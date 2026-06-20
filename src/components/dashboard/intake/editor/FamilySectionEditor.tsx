import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { getFieldLabel } from '@/lib/intake/labels';
import {
	DEFAULT_PARENTS_ORDER,
	formatFamilyMembersAsLines,
	type ParentsOrder,
} from '@/lib/invitation/family-contract';
import type {
	FamilyDraft,
	FamilyGroupDraft,
	GodparentGroupDraft,
} from '@/lib/intake/schemas/family-draft.schema';
import type { FamilyPresentation } from '@/lib/invitation/presentation-options';

interface Props {
	family: FamilyDraft;
	eventType: string;
	invitationId: string;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateFamily: (patch: Partial<FamilyDraft>) => void;
	onOpenAssetPicker: (field: 'family.featuredImage') => void;
	assetLookupSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
}

interface RepeatingField<T> {
	name: keyof T;
	label: string;
	placeholder?: string;
	type: 'field' | 'textarea';
}

function RepeatingGroupEditor<T extends Record<string, unknown>>({
	groups,
	onUpdateGroups,
	addButtonLabel,
	helperText,
	groupLabel,
	fields,
	createEmpty,
	prefix,
}: {
	groups: T[];
	onUpdateGroups: (groups: T[]) => void;
	addButtonLabel: string;
	helperText: string;
	groupLabel: string;
	fields: RepeatingField<T>[];
	createEmpty: () => T;
	prefix: string;
}) {
	const updateGroup = (index: number, patch: Partial<T>) => {
		const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
		onUpdateGroups(next);
	};

	return (
		<div className="invitation-editor__stack">
			<strong>{groupLabel}</strong>
			<p className="invitation-editor__helper-text">{helperText}</p>
			{groups.map((group, index) => (
				<div className="invitation-editor__list-item" key={`${prefix}-${index}`}>
					<div className="invitation-editor__compact-row">
						<strong>
							{groupLabel} {index + 1}
						</strong>
						<button
							type="button"
							className="invitation-editor__link-button"
							onClick={() => onUpdateGroups(groups.filter((_, i) => i !== index))}
						>
							Eliminar
						</button>
					</div>
					<div className="invitation-editor__field-grid">
						{fields
							.filter((f) => f.type === 'field')
							.map((field) => (
								<Field
									key={String(field.name)}
									label={field.label}
									placeholder={field.placeholder ?? ''}
									value={String(group[field.name] ?? '')}
									onChange={(value) =>
										updateGroup(index, {
											[field.name]: value,
										} as unknown as Partial<T>)
									}
								/>
							))}
					</div>
					{fields
						.filter((f) => f.type === 'textarea')
						.map((field) => (
							<TextArea
								key={String(field.name)}
								label={field.label}
								value={String(group[field.name] ?? '')}
								onChange={(value) =>
									updateGroup(index, {
										[field.name]: value,
									} as unknown as Partial<T>)
								}
							/>
						))}
				</div>
			))}
			<button
				type="button"
				className="invitation-editor__secondary-button"
				onClick={() => onUpdateGroups([...groups, createEmpty()])}
			>
				{addButtonLabel}
			</button>
		</div>
	);
}

function SectionCopyFields({
	family,
	eventType,
	onUpdateFamily,
}: {
	family: FamilyDraft;
	eventType: string;
	onUpdateFamily: (patch: Partial<FamilyDraft>) => void;
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
					label={getFieldLabel('family', 'fatherRole', eventType)}
					placeholder="Padre"
					value={family.fatherRole ?? ''}
					onChange={(value) => onUpdateFamily({ fatherRole: value })}
				/>
				<Field
					label={getFieldLabel('family', 'motherRole', eventType)}
					placeholder="Madre"
					value={family.motherRole ?? ''}
					onChange={(value) => onUpdateFamily({ motherRole: value })}
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

const GROUP_FIELDS: RepeatingField<FamilyGroupDraft>[] = [
	{ name: 'title', label: 'Título del grupo', placeholder: 'Padrinos', type: 'field' },
	{ name: 'names', label: 'Nombres (uno por línea)', type: 'textarea' },
];

const GODPARENT_GROUP_FIELDS: RepeatingField<GodparentGroupDraft>[] = [
	{
		name: 'honoreeName',
		label: 'Nombre de festejada',
		placeholder: 'Luna Yamileth',
		type: 'field',
	},
	{ name: 'label', label: 'Etiqueta del grupo', placeholder: 'De Luna', type: 'field' },
	{ name: 'names', label: 'Padrinos', type: 'textarea' },
];

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
	const godparentGroups = family.godparentGroups ?? [];

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

			<label className="invitation-editor__field">
				<span>Presentación</span>
				<select
					value={family.presentation ?? ''}
					onChange={(event) =>
						onUpdateFamily({
							presentation: (event.target.value || undefined) as
								| FamilyPresentation
								| undefined,
						})
					}
				>
					<option value="">Con foto</option>
					<option value="with-photo">Con foto</option>
					<option value="text-only">Solo texto</option>
				</select>
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
			<label className="invitation-editor__field">
				<span>Orden de padres</span>
				<select
					value={family.parentsOrder ?? DEFAULT_PARENTS_ORDER}
					onChange={(event) => {
						onUpdateFamily({ parentsOrder: event.target.value as ParentsOrder });
					}}
				>
					<option value="father-first">Papá primero</option>
					<option value="mother-first">Mamá primero</option>
				</select>
			</label>
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
			{godparentGroups.length > 0 ? (
				<p className="invitation-editor__helper-text">
					Los padrinos generales no se usarán porque hay grupos de padrinos por festejada
					configurados abajo.
				</p>
			) : (
				<TextArea
					label={getFieldLabel('family', 'godparents', eventType)}
					value={formatFamilyMembersAsLines(family.godparents) ?? ''}
					onChange={(value) => onUpdateFamily({ godparents: value })}
				/>
			)}
			<RepeatingGroupEditor
				prefix="godparent-group"
				groups={godparentGroups}
				onUpdateGroups={(next) => onUpdateFamily({ godparentGroups: next })}
				groupLabel="Grupo"
				helperText="Usa estos grupos cuando cada festejada tenga padrinos distintos."
				addButtonLabel="Agregar grupo de padrinos"
				fields={GODPARENT_GROUP_FIELDS}
				createEmpty={() => ({ honoreeName: '', label: '', names: '' })}
			/>
			{isBoda && (
				<TextArea
					label={getFieldLabel('family', 'children', eventType)}
					value={family.children ?? ''}
					onChange={(value) => onUpdateFamily({ children: value })}
				/>
			)}

			<RepeatingGroupEditor
				prefix="group"
				groups={groups}
				onUpdateGroups={(next) => onUpdateFamily({ groups: next })}
				groupLabel="Grupo"
				helperText="Usa grupos para padres de la novia, padrinos, abuelos u otros familiares. Cada nombre en una línea separada."
				addButtonLabel="Agregar grupo"
				fields={GROUP_FIELDS}
				createEmpty={() => ({ title: '', names: '' })}
			/>

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
