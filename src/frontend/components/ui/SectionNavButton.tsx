// src/frontend/components/ui/SectionNavButton.tsx

import React from 'react';
import ArrowDownIcon from '@components/icons/commons/ArrowDownIcon';
import navButtonStyles from '@styles/components/sectionNavButton.module.scss';

interface SectionNavButtonProps {
	/** Target URL or section anchor (e.g., "#section-id") */
	href: string;
	/** Optionally, specify a section variant (e.g., "hero") to aplicar estilos especiales */
	section?: 'hero';
}

const SectionNavButton: React.FC<SectionNavButtonProps> = ({ href, section }) => {
	return (
		<a
			href={href}
			title="Section Navigation"
			className={`${navButtonStyles['section-nav-button']} ${
				section === 'hero' ? navButtonStyles['hero__nav-button'] : ''
			}`}
		>
			<div className={navButtonStyles['section-nav-button__icon']}>
				<ArrowDownIcon />
			</div>
		</a>
	);
};

export default SectionNavButton;
