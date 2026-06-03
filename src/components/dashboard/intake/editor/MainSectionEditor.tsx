import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { AssetField } from '@/lib/assets/asset-source';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { getFieldLabel } from '@/lib/intake/labels';

interface HeroData {
	name?: string;
	secondaryName?: string;
	label?: string;
	nickname?: string;
	date?: string;
	backgroundImage?: AssetField;
	portrait?: AssetField;
}

interface Props {
	content: DraftContent;
	main: HeroData;
	eventType: string;
	invitationId: string;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateContent: <K extends keyof DraftContent>(key: K, value: DraftContent[K]) => void;
	onUpdateHero: (patch: Partial<HeroData>) => void;
	onOpenAssetPicker: (field: string) => void;
	previewSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
}

export default function MainSectionEditor({
	content,
	main,
	eventType,
	invitationId,
	dirty,
	error,
	success,
	sourceBadge,
	onUpdateContent,
	onUpdateHero,
	onOpenAssetPicker,
	previewSlug,
	assets,
	visible = true,
}: Props) {
	const isBoda = eventType === 'boda';
	return (
		<SectionCard
			id="main"
			title="Datos principales"
			description="Texto principal que abre la invitación."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<div className="invitation-editor__field-grid">
				<Field
					label="Título público"
					value={content.title ?? ''}
					onChange={(value) => onUpdateContent('title', value)}
				/>
				<Field
					label={getFieldLabel('hero', 'name', eventType)}
					value={main.name ?? ''}
					onChange={(value) => onUpdateHero({ name: value })}
				/>
				{isBoda && (
					<Field
						label={getFieldLabel('hero', 'secondaryName', eventType)}
						value={main.secondaryName ?? ''}
						onChange={(value) => onUpdateHero({ secondaryName: value })}
					/>
				)}
				<Field
					label={getFieldLabel('hero', 'label', eventType)}
					value={main.label ?? ''}
					onChange={(value) => onUpdateHero({ label: value })}
				/>
				<Field
					label={getFieldLabel('hero', 'nickname', eventType)}
					value={main.nickname ?? ''}
					onChange={(value) => onUpdateHero({ nickname: value })}
				/>
				<Field
					label={getFieldLabel('hero', 'date', eventType)}
					type="datetime-local"
					value={(main.date ?? '').replace('Z', '').slice(0, 16)}
					onChange={(value) => onUpdateHero({ date: value })}
				/>
				{invitationId && (
					<>
						<ImageAssetField
							label="Imagen de portada"
							value={main.backgroundImage}
							previewSlug={previewSlug}
							assets={assets}
							onOpenLibrary={() => onOpenAssetPicker('hero.backgroundImage')}
						/>
						<ImageAssetField
							label="Retrato"
							value={main.portrait}
							emptyActionLabel="Seleccionar retrato"
							changeActionLabel="Cambiar retrato"
							previewSlug={previewSlug}
							assets={assets}
							onOpenLibrary={() => onOpenAssetPicker('hero.portrait')}
						/>
					</>
				)}
			</div>
			<TextArea
				label="Descripción"
				value={content.description ?? ''}
				onChange={(value) => onUpdateContent('description', value)}
				labelExtra={
					<TextPresetPicker
						section="description"
						eventType={eventType}
						onSelect={(value) => onUpdateContent('description', value)}
					/>
				}
			/>
		</SectionCard>
	);
}
