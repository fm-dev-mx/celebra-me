// src/components/common/actions/ActionBase.tsx

import { ElementType } from '@/core/types/ui/component.type';
import { ActionBaseProps } from '@/core/types/ui/action.types';

/**
 * ActionBase component provides a flexible structure for different types of actions.
 * It applies consistent styling and allows for customization.
 *
 * @template T - The type of element to render (e.g., 'a', 'button')
 * @param {ActionBaseProps<T>} props - The props for the component
 * @returns {JSX.Element} The rendered component
 */
const ActionBase = <T extends ElementType = 'button'>({
	as,
	variant = 'primary',
	href,
	color = 'primary',
	target,
	rel,
	className = '',
	children,
	...rest
}: ActionBaseProps<T>): JSX.Element => {
	// Ensure 'as' has a default value
	const Tag = (as || 'button') as React.ElementType;

	// Generate class names based on variant and color
	const variantClass = `action-${variant}`;
	const colorClass = `color-${color}`;
	const combinedClasses = `action-base ${variantClass} ${colorClass} ${className}`.trim();

	// Define props specific to anchor elements
	const anchorProps =
		as === 'a'
			? {
					href,
					target,
					rel: target === '_blank' ? 'noopener noreferrer' : undefined,
				}
			: {};

	// Render the component
	return (
		<div className="action-base-wrapper">
			<Tag
				className={combinedClasses}
				{...(anchorProps as Record<string, any>)}
				{...(rest as Record<string, any>)}
			>
				{children}
			</Tag>
		</div>
	);
};

export default ActionBase;
