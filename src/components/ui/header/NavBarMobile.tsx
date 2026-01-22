import React from 'react';
import type { NavBarProps } from '../../../interfaces/ui/components/navBar.interface';

const NavBarMobile: React.FC<NavBarProps> = ({ links = [] }) => {
	return (
		<div className="md:hidden flex flex-col gap-4">
			{links.map((link, i) => (
				<a key={i} href={link.href} className="hover:text-primary">
					{link.label}
				</a>
			))}
		</div>
	);
};

export default NavBarMobile;
