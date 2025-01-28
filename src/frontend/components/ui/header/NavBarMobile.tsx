// src/frontend/components/ui/header/NavBarMobile.tsx

import React, { useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import Icon from '@components/common/Icon';
import ActionBase from '@components/common/actions/ActionBase';
import Logo from '../Logo';
import { useToggleMobileMenu } from '@/frontend/hooks/header/useToggleMobileMenu';
import SocialMediaLinks from '@components/common/actions/SocialMediaLinks';
import { NavBarProps } from '../../../../core/interfaces/ui/components/navBar.interface';
import useActivePath from '@hooks/header/useActivePath';

/**
 * NavBarMobile manages a full-screen mobile menu when isMobileMenuOpen is true.
 */
const NavBarMobile: React.FC<NavBarProps> = ({
	links = [],
	socialLinkList: socialData,
	ctaLabel = 'Ver demos',
	headerId = 'mobile-menu',
}) => {
	// Reference to the mobile menu container
	const menuRef = useRef<HTMLDivElement>(null);

	// Hook for controlling open/close
	const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useToggleMobileMenu(menuRef);

	// Track the current path to highlight links (if needed)
	const currentPath = useActivePath();

	return (
		<div className="navbar-mobile w-full">
			<div className="navbar-mobile-header">
				<Logo />
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
										// You can close the menu on link click if you like
										onClick={closeMobileMenu}
										target={isExternal ? target || '_blank' : '_self'}
										rel={isExternal ? 'noopener noreferrer' : undefined}
									>
										{label}
									</a>
								</li>
							))
						) : (
							<li>No links available</li>
						)}
					</ul>

					<div className="mobile-menu-cta">
						<ActionBase
							variant="secondary"
							color="secondary"
							as="a"
							href="#"
							className="cta-button-mobile"
							// Close menu on CTA click
							onClick={closeMobileMenu}
						>
							{ctaLabel}
						</ActionBase>
					</div>

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
