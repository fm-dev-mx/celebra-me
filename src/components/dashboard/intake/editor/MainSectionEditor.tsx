import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { EditableAssetSource } from '@/lib/assets/asset-source';
import { getFieldLabel } from '@/lib/intake/labels';

type AssetField = string | EditableAssetSource;

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
	saving: boolean;
	error?: string;
	success?: string;
	onSave: () => void;
	sourceBadge?: { source: string; label: string };
	onUpdateContent: <K extends keyof DraftContent>(key: K, value: DraftContent[K]) => void;
	onUpdateHero: (patch: Partial<HeroData>) => void;
	onOpenAssetPicker: (field: string) => void;
}

export default function MainSectionEditor({
	content,
	main,
	eventType,
	invitationId,
	dirty,
	saving,
	error,
	success,
	onSave,
	sourceBadge,
	onUpdateContent,
	onUpdateHero,
	onOpenAssetPicker,
}: Props) {
	const isBoda = eventType === 'boda';
	return (
		<SectionCard
			id="main"
			title="Datos principales"
			description="Texto principal que abre la invitación."
			dirty={dirty}
			saving={saving}
			error={error}
			success={success}
			onSave={onSave}
			sourceBadge={sourceBadge}
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
						<label className="invitation-editor__field">
							<span>Imagen de portada</span>
							<button
								type="button"
								className="invitation-editor__asset-btn"
								onClick={() => onOpenAssetPicker('hero.backgroundImage')}
							>
								{main.backgroundImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
							</button>
						</label>
						<label className="invitation-editor__field">
							<span>Retrato</span>
							<button
								type="button"
								className="invitation-editor__asset-btn"
								onClick={() => onOpenAssetPicker('hero.portrait')}
							>
								{main.portrait ? 'Cambiar retrato' : 'Seleccionar retrato'}
							</button>
						</label>
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
