import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ICON_CATALOG, type IconName, type IconCategory } from '@/lib/icons/icon-catalog';
import { resolveIconComponent } from '@/components/common/icons/registry';

const iconComponentCache = new Map<string, ReturnType<typeof resolveIconComponent>>();
function getCachedIcon(name: string) {
	if (!iconComponentCache.has(name)) {
		iconComponentCache.set(name, resolveIconComponent(name));
	}
	return iconComponentCache.get(name);
}

interface IconPickerFieldProps {
	label: string;
	value: IconName | null;
	onChange: (value: IconName | null) => void;
	allowedIcons?: readonly IconName[];
	allowedCategories?: readonly IconCategory[];
	helperText?: string;
}

type CatalogEntry = (typeof ICON_CATALOG)[number];

const CATEGORY_LABELS: Record<IconCategory, string> = {
	ceremony: 'Ceremonia',
	reception: 'Recepción',
	party: 'Fiesta',
	music: 'Música',
	western: 'Western',
	dress: 'Vestimenta',
	info: 'Información',
	decorative: 'Decorativo',
	gifts: 'Regalos',
};

function IconPreview({ name, size = 24 }: { name: string; size?: number }) {
	const Component = getCachedIcon(name);
	if (!Component) return <span className="icon-picker-field__fallback">?</span>;
	return <Component size={size} />;
}

export default function IconPickerField({
	label,
	value,
	onChange,
	allowedIcons,
	allowedCategories,
	helperText,
}: IconPickerFieldProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleOutsideClick = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, [isOpen]);
	const [search, setSearch] = useState('');
	const [activeCategory, setActiveCategory] = useState<IconCategory | 'all'>('all');

	const filteredIcons = useMemo(() => {
		let icons: CatalogEntry[] = [...ICON_CATALOG];

		if (allowedIcons) {
			const allowed = new Set(allowedIcons);
			icons = icons.filter((icon) => allowed.has(icon.name as IconName));
		}

		if (allowedCategories) {
			const allowed = new Set<IconCategory>(allowedCategories as IconCategory[]);
			icons = icons.filter((icon) => allowed.has(icon.category as IconCategory));
		}

		if (activeCategory !== 'all') {
			icons = icons.filter((icon) => icon.category === activeCategory);
		}

		if (search.trim()) {
			const query = search.toLowerCase().trim();
			icons = icons.filter(
				(icon) =>
					icon.label.toLowerCase().includes(query) ||
					icon.name.toLowerCase().includes(query) ||
					icon.keywords.some((kw) => kw.toLowerCase().includes(query)),
			);
		}

		return icons;
	}, [allowedIcons, allowedCategories, activeCategory, search]);

	const categories = useMemo(() => {
		const cats = new Set<IconCategory>();
		for (const entry of filteredIcons) {
			cats.add(entry.category as IconCategory);
		}
		return Array.from(cats);
	}, [filteredIcons]);

	const selectedEntry = value ? ICON_CATALOG.find((e) => e.name === value) : null;

	const handleSelect = useCallback(
		(name: IconName) => {
			onChange(name);
			setIsOpen(false);
			setSearch('');
		},
		[onChange],
	);

	const handleClear = useCallback(() => {
		onChange(null);
		setIsOpen(false);
	}, [onChange]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
		if (event.key === 'Escape') {
			setIsOpen(false);
		}
	}, []);

	return (
		<div className="icon-picker-field" ref={containerRef}>
			<label className="icon-picker-field__label">{label}</label>
			<button
				type="button"
				className="icon-picker-field__trigger"
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
			>
				{selectedEntry ? (
					<>
						<span className="icon-picker-field__preview">
							<IconPreview name={selectedEntry.name} size={20} />
						</span>
						<span className="icon-picker-field__selected-label">
							{selectedEntry.label}
						</span>
					</>
				) : (
					<span className="icon-picker-field__placeholder">Seleccionar ícono...</span>
				)}
				<span className="icon-picker-field__chevron">▼</span>
			</button>

			{helperText && <p className="icon-picker-field__helper">{helperText}</p>}

			{isOpen && (
				<div className="icon-picker-field__dropdown" onKeyDown={handleKeyDown}>
					<div className="icon-picker-field__search">
						<input
							type="text"
							placeholder="Buscar..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							autoFocus
						/>
					</div>

					{categories.length > 1 && (
						<div className="icon-picker-field__categories">
							<button
								type="button"
								className={`icon-picker-field__category ${activeCategory === 'all' ? 'icon-picker-field__category--active' : ''}`}
								onClick={() => setActiveCategory('all')}
							>
								Todos
							</button>
							{categories.map((cat) => (
								<button
									key={cat}
									type="button"
									className={`icon-picker-field__category ${activeCategory === cat ? 'icon-picker-field__category--active' : ''}`}
									onClick={() => setActiveCategory(cat)}
								>
									{CATEGORY_LABELS[cat] ?? cat}
								</button>
							))}
						</div>
					)}

					<div className="icon-picker-field__grid">
						{filteredIcons.length === 0 ? (
							<p className="icon-picker-field__empty">Sin resultados</p>
						) : (
							filteredIcons.map((icon) => (
								<button
									key={icon.name}
									type="button"
									className={`icon-picker-field__option ${value === icon.name ? 'icon-picker-field__option--selected' : ''}`}
									onClick={() => handleSelect(icon.name)}
									title={icon.label}
								>
									<span className="icon-picker-field__option-icon">
										<IconPreview name={icon.name} size={24} />
									</span>
									<span className="icon-picker-field__option-label">
										{icon.label}
									</span>
								</button>
							))
						)}
					</div>

					{value && (
						<div className="icon-picker-field__actions">
							<button
								type="button"
								className="icon-picker-field__clear"
								onClick={handleClear}
							>
								Sin ícono
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
