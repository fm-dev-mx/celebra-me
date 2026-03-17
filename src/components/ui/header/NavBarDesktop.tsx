import React from 'react';
import type { NavBarProps } from '../../../interfaces/ui/components/nav-bar.interface';

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
