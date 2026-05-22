import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFloatingMenuOptions {
	menuWidth?: number;
	menuGap?: number;
	trackVertical?: boolean;
}

export function useFloatingMenu(options: UseFloatingMenuOptions = {}) {
	const { menuWidth = 220, menuGap = 4, trackVertical = true } = options;

	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const uid = useRef(crypto.randomUUID());
	const menuId = `menu-${uid.current}`;

	const close = useCallback(() => {
		setOpen(false);
	}, []);

	const reposition = useCallback(() => {
		const trigger = triggerRef.current;
		const menu = menuRef.current;
		if (!trigger || !menu) return;

		const rect = trigger.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;

		let top = rect.bottom + menuGap;
		let left = rect.right - menuWidth;

		if (left < 8) left = 8;
		if (left + menuWidth > viewportW - 8) left = viewportW - menuWidth - 8;
		if (trackVertical && top + 200 > viewportH) top = rect.top - menuGap - 200;

		menu.style.position = 'fixed';
		menu.style.top = `${Math.max(8, top)}px`;
		menu.style.left = `${Math.max(8, left)}px`;
		menu.style.width = `${menuWidth}px`;
	}, [menuWidth, menuGap, trackVertical]);

	useEffect(() => {
		if (!open) return;
		reposition();
		window.addEventListener('scroll', reposition, true);
		window.addEventListener('resize', reposition);
		return () => {
			window.removeEventListener('scroll', reposition, true);
			window.removeEventListener('resize', reposition);
		};
	}, [open, reposition]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				triggerRef.current?.focus();
				close();
			}
		};
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node) &&
				triggerRef.current &&
				!triggerRef.current.contains(e.target as Node)
			) {
				close();
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [open, close]);

	const toggle = useCallback(() => {
		setOpen((v) => !v);
	}, []);

	return {
		open,
		menuId,
		triggerRef,
		menuRef,
		toggle,
		close,
		setOpen,
	};
}
