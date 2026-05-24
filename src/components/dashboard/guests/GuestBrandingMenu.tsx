import React from 'react';
import { useFloatingMenu } from '@/components/dashboard/guests/use-floating-menu';

interface GuestBrandingMenuProps {
	hideCelebraMeBranding: boolean;
	guestId: string;
	onToggle: (guestId: string, hideCelebraMeBranding: boolean) => void;
}

const GuestBrandingMenu: React.FC<GuestBrandingMenuProps> = ({
	hideCelebraMeBranding,
	guestId,
	onToggle,
}) => {
	const { open, menuId, triggerRef, menuRef, toggle, close } = useFloatingMenu();

	const handleClick = () => {
		onToggle(guestId, !hideCelebraMeBranding);
		close();
	};

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className="guest-branding-menu__trigger"
				onClick={toggle}
				title="Opciones de marca"
				aria-label="Opciones de marca"
				aria-haspopup="true"
				aria-expanded={open}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="currentColor"
					aria-hidden="true"
				>
					<circle cx="8" cy="3" r="1.5" />
					<circle cx="8" cy="8" r="1.5" />
					<circle cx="8" cy="13" r="1.5" />
				</svg>
			</button>
			{open && (
				<div
					ref={menuRef}
					id={menuId}
					className="guest-actions-menu"
					role="menu"
					aria-label="Opciones de marca"
				>
					<button
						type="button"
						className="guest-actions-menu__item"
						role="menuitem"
						onClick={handleClick}
					>
						{hideCelebraMeBranding
							? 'Mostrar marca Celebra-me'
							: 'Ocultar marca Celebra-me'}
					</button>
				</div>
			)}
		</>
	);
};

export default GuestBrandingMenu;
