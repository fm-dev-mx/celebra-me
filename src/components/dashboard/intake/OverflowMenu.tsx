import { useEffect, useRef, useState, type FC } from 'react';

export interface OverflowAction {
	label: string;
	onClick: () => void;
	destructive?: boolean;
	disabled?: boolean;
	hidden?: boolean;
}

interface Props {
	items: OverflowAction[];
}

const OverflowMenu: FC<Props> = ({ items }) => {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const visibleItems = items.filter((item) => !item.hidden);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setOpen(false);
				buttonRef.current?.focus();
			}
		};
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [open]);

	if (visibleItems.length === 0) return null;

	return (
		<div className="intake-overflow" ref={menuRef}>
			<button
				type="button"
				className="intake-overflow__trigger"
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Más acciones"
				aria-expanded={open}
				ref={buttonRef}
			>
				•••
			</button>
			{open && (
				<div className="intake-overflow__menu" role="menu">
					{visibleItems.map((item) => (
						<button
							key={item.label}
							type="button"
							className={`intake-overflow__item${item.destructive ? ' intake-overflow__item--danger' : ''}`}
							onClick={() => {
								item.onClick();
								setOpen(false);
							}}
							disabled={item.disabled}
							role="menuitem"
						>
							{item.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

export default OverflowMenu;
