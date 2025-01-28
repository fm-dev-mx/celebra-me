import React, { useState, useCallback } from 'react';
import ActionBase from './ActionBase';
import ConfirmModal from '@components/ui/ConfirmModal';
import type {
	ActionVariants,
	ActionColors,
	BaseActionVariants,
	ExternalVariants,
} from '@customTypes/ui/action.types';
import type { MouseEvent as ReactMouseEvent } from 'react';

interface ActionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	href: string;
	confirmMessage?: string;
	confirmTitle?: string;
	confirmButtonText?: string;
	cancelButtonText?: string;
	variant?: BaseActionVariants;
	externalVariant?: ExternalVariants; // External prefixed variants to avoid duplicates
	color?: ActionColors;
	className?: string;
}

const ActionExternalLink: React.FC<ActionLinkProps> = ({
	href,
	variant = 'primary',
	externalVariant,
	color = 'primary',
	confirmMessage = 'Are you sure you want to proceed?',
	confirmTitle = 'Confirmation',
	confirmButtonText = 'Confirm',
	cancelButtonText = 'Cancel',
	className,
	children,
	...rest
}) => {
	const [isModalVisible, setIsModalVisible] = useState(false);
	const computedVariant: ActionVariants =
		externalVariant ?? (`external-${variant}` as ActionVariants);

	const handleClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		setIsModalVisible(true);
	}, []);

	const handleCancel = useCallback(() => {
		setIsModalVisible(false);
	}, []);

	const handleConfirm = useCallback(() => {
		setIsModalVisible(false);
		window.open(href, '_blank', 'noopener,noreferrer');
	}, [href]);

	return (
		<>
			<ActionBase
				as="a"
				href={href}
				variant={computedVariant}
				color={color}
				className={className}
				onClick={handleClick}
				{...rest}
			>
				{children}
			</ActionBase>
			{isModalVisible && (
				<ConfirmModal
					show={true}
					title={confirmTitle}
					message={confirmMessage}
					confirmButtonText={confirmButtonText}
					cancelButtonText={cancelButtonText}
					onConfirm={handleConfirm}
					onCancel={handleCancel}
				/>
			)}
		</>
	);
};

export default ActionExternalLink;
