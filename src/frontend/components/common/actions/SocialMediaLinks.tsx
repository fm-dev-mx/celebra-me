// src/frontend/components/common/actions/SocialMediaLinks.tsx
import React from 'react';
import ActionIcon from '@components/common/actions/ActionIcon';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import { SocialLinkList } from '@interfaces/ui/components/socialLink.interface';

const SocialMediaLinks: React.FC<SocialLinkList> = ({
	links = [],
	variant,
}): JSX.Element | null => {
	const isValidUrl = (url: string) => /^https?:\/\/.+$/.test(url);

	const validatedLinks = links.filter((social) => isValidUrl(social.href) && social.platform);

	if (!validatedLinks.length) return null;

	return (
		<div className="social-media-links">
			{validatedLinks.map((social) => (
				<ActionIcon
					key={social.href} // Use 'url' as unique key
					as="a"
					variant={variant}
					icon={(social.platform + 'Icon') as IconNames}
					href={social.href}
					title={social.platform}
					target="_blank"
					rel="noopener noreferrer" // Improve security
				/>
			))}
		</div>
	);
};

export default SocialMediaLinks;
