import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface UseFloatingMenuOptions {
	menuWidth?: number;
	menuGap?: number;
	trackVertical?: boolean;
}

function getMenuItems(menu: HTMLElement | null): HTMLElement[] {
	if (!menu) return [];
	return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
}

/** Arrow keys wrap around; Home and End jump to the ends. */
function getNavigationIndex(key: string, current: number, count: number): number | null {
	switch (key) {
		case 'ArrowDown':
			return (current + 1) % count;
		case 'ArrowUp':
			return current <= 0 ? count - 1 : current - 1;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

export function useFloatingMenu(options: UseFloatingMenuOptions = {}) {
	const { menuWidth = 220, menuGap = 4, trackVertical = true } = options;

	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const id = useId();
	const menuId = `menu-${id}`;

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

	// The menu renders in a portal at the end of <body>, so the natural tab order never
	// reaches it: focus moves into it on open and back to the trigger when it closes.
	const wasOpenRef = useRef(false);
	// A pointer dismissal leaves focus where the pointer went.
	const restoreFocusRef = useRef(true);
	useEffect(() => {
		if (open) {
			wasOpenRef.current = true;
			restoreFocusRef.current = true;
			getMenuItems(menuRef.current)[0]?.focus();
			return;
		}
		if (!wasOpenRef.current) return;
		wasOpenRef.current = false;
		if (!restoreFocusRef.current) return;
		// Only when focus was lost with the menu; an action may have moved it elsewhere.
		const active = document.activeElement;
		if (!active || active === document.body) triggerRef.current?.focus();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				triggerRef.current?.focus();
				close();
				return;
			}
			if (e.key === 'Tab') {
				// Continue the tab order from the trigger, not from the end of the page;
				// Shift+Tab stops on the trigger itself.
				if (e.shiftKey) e.preventDefault();
				triggerRef.current?.focus();
				close();
				return;
			}
			const items = getMenuItems(menuRef.current);
			if (items.length === 0) return;
			const current = items.indexOf(document.activeElement as HTMLElement);
			const target = getNavigationIndex(e.key, current, items.length);
			if (target === null) return;
			e.preventDefault();
			items[target]?.focus();
		};
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node) &&
				triggerRef.current &&
				!triggerRef.current.contains(e.target as Node)
			) {
				restoreFocusRef.current = false;
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
