/**
 * src/frontend/components/ui/header/NavBarDesktop.tsx
 *
 * NavBarDesktop component handles the desktop navigation menu
 * and renders navigation links, social media links, and a CTA button.
 */

import React from 'react';
import { twMerge } from 'tailwind-merge';
import Logo from '../Logo';
import ActionBase from '@components/common/actions/ActionBase';
import SocialMediaLinks from '@components/common/actions/SocialMediaLinks';
import { NavBarProps } from '@interfaces/ui/components/navBar.interface';
import useActivePath from '@hooks/header/useActivePath';

const NavBarDesktop: React.FC<NavBarProps> = ({
	links = [],
	socialLinkList,
	ctaLabel = 'Ver demos',
}) => {
	// Track the current path to highlight the active link
	const currentPath = useActivePath();

	return (
		<nav className="navbar-desktop" role="navigation" aria-label="Desktop Navigation">
			<div className="navbar-desktop-logo-wrapper">
				{/* Render the site logo */}
				<Logo altText="Celebra-me Desktop Logo" />
			</div>

			{/* Desktop navigation links */}
			<div className="navbar-desktop-links-wrapper">
				{links.length > 0 && (
					<ul className="navbar-desktop-list">
						{links.map(({ label, href, isExternal, target }) => (
							<li key={href} className="navbar-desktop-item">
								<a
									href={href}
									className={twMerge(
										'navbar-desktop-link',
										currentPath === href && 'active',
									)}
									target={isExternal ? target || '_blank' : '_self'}
									rel={isExternal ? 'noopener noreferrer' : undefined}
								>
									{label}
								</a>
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Social media links */}
			<SocialMediaLinks links={socialLinkList?.links ?? []} variant="social-desktop-header" />

			{/* Call-to-action button */}
			<div className="navbar-desktop-cta-wrapper">
				<ActionBase
					as="a"
					href="#"
					variant="secondary"
					color="primary"
					className="navbar-desktop-cta"
				>
					{ctaLabel}
				</ActionBase>
			</div>
		</nav>
	);
};

export default NavBarDesktop;
