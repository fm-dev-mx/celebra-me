// src/components/common/SocialMediaLinks.tsx

import React from "react";
import ActionIcon from "@/components/common/actions/ActionIcon";
import type { SocialLink, IconNames } from "@/config/siteData.interface";

export type SocialVariants = "social-desktop-header" | "social-mobile-header" | "social-footer";

interface SocialMediaLinksProps {
	links: SocialLink[];
	variant?: SocialVariants;
}

/**
 * SocialMediaLinks component renders a list of social media icons as links.
 * It uses the ActionWrapper and ActionIcon components to display each icon.
 *
 * @param {SocialMediaLinksProps} props - The props for the component
 * @returns {JSX.Element | null} The rendered component or null if no links
 */
const SocialMediaLinks: React.FC<SocialMediaLinksProps> = ({ links, variant }) => {
	// If there are no links provided, render nothing
	if (!links || links.length === 0) return null;

	return (
		// Use ActionWrapper to wrap the list of icons with optional custom classes
		<div className={"social-media-links"}>
			{/* Map over each social link and render an ActionIcon */}
			{links.map((social, index) => (
				<ActionIcon
					key={index}
					as="a" // Render as an anchor element
					variant={variant} // Use appropriate variant
					icon={social.icon as IconNames} // Icon to display
					href={social.href} // URL to link to
					title={social.title || "Social Media"} // Tooltip or accessible label
					target="_blank"
				/>
			))}
		</div>
	);
};

export default SocialMediaLinks;
