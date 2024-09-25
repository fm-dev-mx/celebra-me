// src/components/ui/header/NavBarDesktop.tsx
// NavBarDesktop component handles the desktop navigation menu and renders navigation links dynamically.

import React, { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import ActionBase from "@/components/common/actions/ActionBase";
import SocialMediaLinks from "@/components/common/actions/SocialMediaLinks";
import type { MenuData, SocialData } from "@/config/landing.interface";
import Logo from "../Logo";

interface NavBarDesktopProps {
	menuData: MenuData;
	socialData: SocialData;
}

const NavBarDesktop: React.FC<NavBarDesktopProps> = ({ menuData, socialData }) => {
	const [currentPath, setCurrentPath] = useState<string>("");

	useEffect(() => {
		// Set the current path to highlight the active link based on the current location
		if (typeof window !== "undefined") {
			setCurrentPath(window.location.pathname);
		}
	}, []);

	return (
		console.log("menuData: ", menuData),
		console.log("socialData: ", socialData),
		(
			<nav className="navbar-desktop">
				<div className="navbar-desktop-logo-wrapper">
					<Logo />
				</div>
				<div className="navbar-desktop-links-wrapper">
					<ul className="navbar-desktop-list">
						{menuData?.links?.length > 0 ? (
							menuData.links.map((item) => (
								<li key={item.href} className="navbar-desktop-item">
									<a
										href={item.href}
										className={twMerge(
											"navbar-desktop-link",
											currentPath === item.href ? "active" : "",
										)}
									>
										{item.label}
									</a>
								</li>
							))
						) : (
							<li>No links available</li>
						)}
					</ul>
				</div>

				<SocialMediaLinks links={socialData.socialLinks} variant="social-desktop-header" />

				<div className="navbar-desktop-cta-wrapper">
					<ActionBase
						variant="secondary"
						as="a"
						href="#"
						color="primary"
						className="navbar-desktop-cta"
					>
						Ver demos
					</ActionBase>
				</div>
			</nav>
		)
	);
};

export default NavBarDesktop;
