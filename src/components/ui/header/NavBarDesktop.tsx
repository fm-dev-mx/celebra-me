import React from 'react';
import type { NavBarProps } from '../../../interfaces/ui/components/navBar.interface';

const NavBarDesktop: React.FC<NavBarProps> = ({ links = [] }) => {
	return (
		<div className="nav-bar-desktop">
			{links.map((link, i) => (
				<a key={i} href={link.href} className="nav-bar-desktop__link">
					{link.label}
				</a>
			))}
		</div>
	);
};

export default NavBarDesktop;
