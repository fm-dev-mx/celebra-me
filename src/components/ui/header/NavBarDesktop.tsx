import React from 'react';
import type { NavBarProps } from '../../../interfaces/ui/components/navBar.interface';

const NavBarDesktop: React.FC<NavBarProps> = ({ links = [] }) => {
	return (
		<div className="hidden md:flex gap-6">
			{links.map((link, i) => (
				<a key={i} href={link.href} className="hover:text-primary">
					{link.label}
				</a>
			))}
		</div>
	);
};

export default NavBarDesktop;
