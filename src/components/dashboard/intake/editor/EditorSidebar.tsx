import { NAV_ITEMS } from '@/lib/intake/labels';
import { moveArrayItem } from '@/lib/intake/utils';
import {
	getSidebarAdminEditorCardIds,
	getPublicSectionDefinitions,
	deriveOrderedPublicSections,
	getSectionVisibilityStatus,
	type PublicSectionDefinition,
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
}: Props) {
	const adminCardIds = getSidebarAdminEditorCardIds();
	const adminItems = NAV_ITEMS.filter((item) => adminCardIds.includes(item.id));

	const orderedPublicSections = deriveOrderedPublicSections(sectionOrder);

	// Sections not in the current order (hidden / newly available) appended at the end
	const orderedIds = new Set(orderedPublicSections.map((d) => d.id));
	const hiddenPublicSections = getPublicSectionDefinitions().filter(
		(def) => def.id !== 'hero' && !orderedIds.has(def.id),
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

	function renderNavItem(item: { id: string; label: string }) {
		const badge = sectionSource(item.id);
		const isSaving = savingSection === item.id;
		const hasError = Boolean(errors[item.id]);
		const itemClasses = classNames(
			'invitation-editor__nav-item',
			activeSection === item.id && 'invitation-editor__nav-item--active',
			hasError && 'invitation-editor__nav-item--error',
		);

		return (
			<a href={`#${item.id}`} key={item.id} className={itemClasses}>
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
				{dirty.has(item.id) && !isSaving && (
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
						title={errors[item.id]}
					>
						!
					</span>
				)}
			</a>
		);
	}

	function renderPublicSectionRow(def: PublicSectionDefinition) {
		const sectionId = def.id;
		const editorCardId = def.editorCardId ?? '';
		const isOrderable = def.isOrderable;
		const isToggleable = def.isToggleable;

		const hasContent = getSectionHasContent(sectionId);
		const status = getSectionVisibilityStatus(sectionId, sectionOrder, hasContent);
		const isVisible = status === 'Visible' || status === 'Requerida';

		const orderIndex = sectionOrder.indexOf(sectionId);
		const canMoveUp = isOrderable && orderIndex > 0;
		const canMoveDown = isOrderable && orderIndex < sectionOrder.length - 1;

		const rowClasses = classNames(
			'invitation-editor__nav-item',
			activeSection === editorCardId && 'invitation-editor__nav-item--active',
			'invitation-editor__nav-item--public',
		);

		return (
			<div key={sectionId} className={rowClasses}>
				{editorCardId ? (
					<a href={`#${editorCardId}`} className="invitation-editor__nav-public-link">
						<span className="invitation-editor__nav-label">{def.label}</span>
					</a>
				) : (
					<span className="invitation-editor__nav-public-link">
						<span className="invitation-editor__nav-label">{def.label}</span>
					</span>
				)}
				<span
					className={`invitation-editor__nav-public-status invitation-editor__nav-public-status--${status
						.normalize('NFD')
						.replace(/[\u0300-\u036f]/g, '')
						.toLowerCase()}`}
				>
					{status}
				</span>
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
				{isOrderable && (
					<span className="invitation-editor__reorder">
						<button
							type="button"
							onClick={() => handleMoveSection(sectionId, -1)}
							disabled={!canMoveUp}
							aria-label={`Mover ${def.label} hacia arriba`}
						>
							Subir
						</button>
						<button
							type="button"
							onClick={() => handleMoveSection(sectionId, 1)}
							disabled={!canMoveDown}
							aria-label={`Mover ${def.label} hacia abajo`}
						>
							Bajar
						</button>
					</span>
				)}
			</div>
		);
	}

	return (
		<nav className="invitation-editor__nav" aria-label="Secciones del editor">
			<div className="invitation-editor__nav-group">
				<span className="invitation-editor__nav-group-label">Secciones públicas</span>
				{allPublicSections.map((def) => renderPublicSectionRow(def))}
				{renderNavItem({ id: 'music', label: 'Música' })}
			</div>
			{adminItems.length > 0 && (
				<div className="invitation-editor__nav-group">
					<span className="invitation-editor__nav-group-label">Administración</span>
					{adminItems.map(renderNavItem)}
				</div>
			)}
		</nav>
	);
}
