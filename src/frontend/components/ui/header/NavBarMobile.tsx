/**
 * src/frontend/components/ui/header/NavBarMobile.tsx
 *
 * NavBarMobile manages a full-screen mobile menu when isMobileMenuOpen is true.
 * It includes the site logo, navigation links, CTA, and social media links.
 */

import React, { useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import Icon from '@components/common/Icon';
import ActionBase from '@components/common/actions/ActionBase';
import Logo from '../Logo';
import { useToggleMobileMenu } from '@/frontend/hooks/header/useToggleMobileMenu';
import SocialMediaLinks from '@components/common/actions/SocialMediaLinks';
import { NavBarProps } from '@interfaces/ui/components/navBar.interface';
import useActivePath from '@hooks/header/useActivePath';

const NavBarMobile: React.FC<NavBarProps> = ({
	links = [],
	socialLinkList: socialData,
	ctaLabel = 'Ver demos',
	headerId = 'mobile-menu',
}) => {
	// Reference to the mobile menu container
	const menuRef = useRef<HTMLDivElement>(null);

	// Hook for controlling open/close state of the mobile menu
	const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useToggleMobileMenu(menuRef);

	// Track the current path to highlight the active link (if needed)
	const currentPath = useActivePath();

	return (
		<div className="navbar-mobile w-full">
			<div className="navbar-mobile-header">
				{/* Mobile version of the logo */}
				<Logo altText="Celebra-me Mobile Logo" />

				{/* Button to toggle mobile menu */}
				<button
					id={`${headerId}-button`}
					className="menu-button"
					aria-label="Open or close mobile menu"
					aria-expanded={isMobileMenuOpen}
					aria-controls={headerId}
					onClick={toggleMobileMenu}
				>
					<Icon icon={isMobileMenuOpen ? 'CloseIcon' : 'MenuIcon'} />
				</button>
			</div>

			{/* Mobile menu overlay */}
			<div
				id={headerId}
				ref={menuRef}
				className={twMerge('mobile-menu', isMobileMenuOpen && 'mobile-menu-open')}
			>
				<nav className="mobile-menu-nav">
					<ul className="mobile-menu-list">
						{links.length > 0 ? (
							links.map(({ label, href, isExternal, target }) => (
								<li key={href} className="mobile-menu-item">
									<a
										href={href}
										className={twMerge(
											'mobile-menu-link',
											currentPath === href && 'active',
										)}
										/* Close the menu on link click */
										onClick={closeMobileMenu}
										target={isExternal ? target || '_blank' : '_self'}
										rel={isExternal ? 'noopener noreferrer' : undefined}
									>
										{label}
									</a>
								</li>
							))
						) : (
							<li className="mobile-menu-item">No links available</li>
						)}
					</ul>

					{/* Call-to-action button */}
					<div className="mobile-menu-cta">
						<ActionBase
							variant="secondary"
							color="secondary"
							as="a"
							href="#"
							className="cta-button-mobile"
							/* Close the menu on CTA click */
							onClick={closeMobileMenu}
						>
							{ctaLabel}
						</ActionBase>
					</div>

					{/* Social media links in the mobile menu */}
					<SocialMediaLinks
						links={socialData?.links ?? []}
						variant="social-mobile-header"
					/>
				</nav>
			</div>
		</div>
	);
};

export default NavBarMobile;
