import { moveArrayItem } from '@/lib/intake/utils';
import {
	getConfigEditorSections,
	getPublicSectionDefinitions,
	deriveOrderedPublicSections,
	getSectionVisibilityStatus,
	type EditorSectionDefinition,
} from '@/lib/intake/invitation-section-registry';

interface Props {
	activeSection: string;
	savingSection: string | null;
	dirty: Set<string>;
	errors: Record<string, string>;
	sectionSource: (section: string) => { source: string; label: string } | undefined;
	sectionOrder: string[];
	onSectionOrderChange: (order: string[]) => void;
	getSectionHasContent: (sectionId: string) => boolean;
	onSelectSection?: (sectionId: string) => void;
}

function classNames(...classes: (string | false | null | undefined)[]): string {
	return classes.filter(Boolean).join(' ');
}

export default function EditorSidebar({
	activeSection,
	savingSection,
	dirty,
	errors,
	sectionSource,
	sectionOrder,
	onSectionOrderChange,
	getSectionHasContent,
	onSelectSection,
}: Props) {
	const includePersonalizedAccess = sectionOrder.includes('personalizedAccess');
	const configItems = getConfigEditorSections({ includePersonalizedAccess });

	const orderedPublicSections = deriveOrderedPublicSections(sectionOrder);

	// Sections not in the current order (hidden / newly available) appended at the end
	const orderedIds = new Set(orderedPublicSections.map((d) => d.id));
	const hiddenPublicSections = getPublicSectionDefinitions().filter(
		(def) => def.sidebarGroup === 'public' && def.id !== 'hero' && !orderedIds.has(def.id),
	);

	// All public sections to render in the sidebar
	const allPublicSections = [...orderedPublicSections, ...hiddenPublicSections];

	function handleMoveSection(id: string, offset: -1 | 1) {
		const index = sectionOrder.indexOf(id);
		if (index === -1) return;
		onSectionOrderChange(moveArrayItem(sectionOrder, index, offset));
	}

	function handleToggleVisibility(sectionId: string, isVisible: boolean) {
		if (isVisible) {
			onSectionOrderChange([...sectionOrder, sectionId]);
		} else {
			onSectionOrderChange(sectionOrder.filter((id) => id !== sectionId));
		}
	}

	function renderConfigItem(item: EditorSectionDefinition) {
		const saveSectionKey = item.saveSectionKey ?? item.id;
		const badge = sectionSource(item.id);
		const isSaving = savingSection === saveSectionKey;
		const hasError = Boolean(errors[saveSectionKey]);
		const itemClasses = classNames(
			'invitation-editor__nav-item',
			activeSection === item.id && 'invitation-editor__nav-item--active',
			hasError && 'invitation-editor__nav-item--error',
		);

		return (
			<button
				type="button"
				key={item.id}
				className={itemClasses}
				onClick={() => onSelectSection?.(item.id)}
			>
				{badge && (
					<span
						className={`invitation-editor__nav-dot invitation-editor__nav-dot--${badge.source}`}
						title={badge.label}
						aria-label={`Fuente: ${badge.label}`}
					/>
				)}
				<span className="invitation-editor__nav-label">{item.label}</span>
				{isSaving && (
					<span className="invitation-editor__nav-saving" aria-label="guardando">
						↻
					</span>
				)}
				{dirty.has(saveSectionKey) && !isSaving && (
					<span
						className="invitation-editor__nav-dirty"
						aria-label="con cambios sin guardar"
					>
						*
					</span>
				)}
				{hasError && (
					<span
						className="invitation-editor__nav-error-icon"
						aria-label="error al guardar"
						title={errors[saveSectionKey]}
					>
						!
					</span>
				)}
			</button>
		);
	}

	function renderPublicSectionRow(def: EditorSectionDefinition) {
		const sectionId = def.id;
		const isOrderable = def.isOrderable;
		const isToggleable = def.isToggleable;
		const saveSectionKey = def.saveSectionKey ?? def.id;

		const hasContent = getSectionHasContent(sectionId);
		const status = getSectionVisibilityStatus(sectionId, sectionOrder, hasContent);
		const isVisible = status === 'Visible' || status === 'Requerida';

		const orderIndex = sectionOrder.indexOf(sectionId);
		const canMoveUp = isOrderable && orderIndex > 0;
		const canMoveDown = isOrderable && orderIndex < sectionOrder.length - 1;

		const rowClasses = classNames(
			'invitation-editor__nav-item',
			activeSection === sectionId && 'invitation-editor__nav-item--active',
			'invitation-editor__nav-item--public',
			Boolean(errors[saveSectionKey]) && 'invitation-editor__nav-item--error',
		);

		return (
			<div key={sectionId} className={rowClasses}>
				<button
					type="button"
					className="invitation-editor__nav-public-link"
					onClick={() => onSelectSection?.(sectionId)}
				>
					<span className="invitation-editor__nav-label">{def.label}</span>
				</button>
				<span
					className={`invitation-editor__nav-public-status invitation-editor__nav-public-status--${status
						.normalize('NFD')
						.replace(/[\u0300-\u036f]/g, '')
						.toLowerCase()}`}
				>
					{status}
				</span>
				{savingSection === saveSectionKey && (
					<span className="invitation-editor__nav-saving" aria-label="guardando">
						↻
					</span>
				)}
				<span className="invitation-editor__nav-public-actions">
					{isOrderable && (
						<span className="invitation-editor__reorder invitation-editor__reorder--compact">
							<button
								type="button"
								onClick={() => handleMoveSection(sectionId, -1)}
								disabled={!canMoveUp}
								aria-label={`Mover ${def.label} hacia arriba`}
							>
								↑
							</button>
							<button
								type="button"
								onClick={() => handleMoveSection(sectionId, 1)}
								disabled={!canMoveDown}
								aria-label={`Mover ${def.label} hacia abajo`}
							>
								↓
							</button>
						</span>
					)}
					{isToggleable && (
						<button
							type="button"
							className="invitation-editor__nav-visibility-toggle"
							onClick={() => handleToggleVisibility(sectionId, !isVisible)}
							aria-label={isVisible ? `Ocultar ${def.label}` : `Mostrar ${def.label}`}
						>
							{isVisible ? 'Ocultar' : 'Mostrar'}
						</button>
					)}
				</span>
			</div>
		);
	}

	return (
		<nav className="invitation-editor__nav" aria-label="Secciones del editor">
			<div className="invitation-editor__nav-group">
				<span className="invitation-editor__nav-group-label">Secciones públicas</span>
				{allPublicSections.map((def) => renderPublicSectionRow(def))}
			</div>
			{configItems.length > 0 && (
				<div className="invitation-editor__nav-group">
					<span className="invitation-editor__nav-group-label">Configuración</span>
					{configItems.map(renderConfigItem)}
				</div>
			)}
		</nav>
	);
}
