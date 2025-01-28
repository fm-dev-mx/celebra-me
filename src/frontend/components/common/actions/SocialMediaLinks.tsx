// src/frontend/components/common/actions/SocialMediaLinks.tsx
import React from 'react';
import ActionIcon from '@components/common/actions/ActionIcon';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { SocialLinkList } from '@interfaces/ui/components/socialLink.interface';

const SocialMediaLinks: React.FC<SocialLinkList> = ({
	links = [],
	variant,
}): JSX.Element | null => {
	// Return null if there are no links
	if (!links || links.length === 0) return null;

	// Function to validate URLs
	const isValidUrl = (url: string) => /^https?:\/\/.+$/.test(url);

	// Filter valid links
	const validatedLinks = links.filter(
		(social) => isValidUrl(social.url) && social.icon && social.title,
	);

	// Render links if there are valid links
	return validatedLinks.length > 0 ? (
		<div className="social-media-links">
			{validatedLinks.map((social) => (
				<ActionIcon
					key={social.url} // Use 'url' as unique key
					as="a"
					variant={variant}
					icon={social.icon as IconNames}
					href={social.url}
					title={social.title}
					target="_blank"
					rel="noopener noreferrer" // Improve security
				/>
			))}
		</div>
	) : null;
};

export default SocialMediaLinks;
