import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type { AssetField } from '@/lib/assets/asset-source';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { getFieldLabel } from '@/lib/intake/labels';

interface FamilyData {
	fatherName?: string;
	fatherDeceased?: boolean;
	motherName?: string;
	motherDeceased?: boolean;
	spouseName?: string;
	godparents?: string;
	children?: string;
	sectionMessage?: string;
	featuredImage?: AssetField;
}

interface Props {
	family: FamilyData;
	eventType: string;
	invitationId: string;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateFamily: (patch: Partial<FamilyData>) => void;
	onOpenAssetPicker: (field: string) => void;
	previewSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
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
	previewSlug,
	assets,
	visible = true,
}: Props) {
	const isBoda = eventType === 'boda';
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
					previewSlug={previewSlug}
					assets={assets}
					onOpenLibrary={() => onOpenAssetPicker('family.featuredImage')}
				/>
			)}
		</SectionCard>
	);
}
