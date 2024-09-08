import React, { useState, useCallback } from 'react';
import ActionBase from './ActionBase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { HTMLAttributes } from 'react';
import type { ActionVariants, ActionColors } from './ActionBase';
import type { MouseEvent as ReactMouseEvent } from 'react';

interface ActionLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string; // The URL that the link will direct to.
  confirmMessage?: string; // Customizable confirmation message to display in the modal.
  confirmTitle?: string; // Title of the confirmation modal.
  confirmButtonText?: string; // Text for the confirm button inside the modal.
  cancelButtonText?: string; // Text for the cancel button inside the modal.
  variant?: ActionVariants; // Inherited from ActionBase for variant styling.
  color?: ActionColors; // Inherited from ActionBase for color styling.
  className?: string; // Allows adding extra classes if needed.
}

const ActionExternalLink: React.FC<ActionLinkProps> = ({
  href,
  variant = 'primary', // Default to 'primary' variant if none is provided.
  color = 'primary', // Default to 'primary' color if none is provided.
  confirmMessage = 'Are you sure you want to proceed?', // Default confirmation message.
  confirmTitle = 'Confirmation', // Default title for the modal.
  confirmButtonText = 'Confirm', // Default text for the confirm button.
  cancelButtonText = 'Cancel', // Default text for the cancel button.
  className,
  ...rest
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault(); // Prevent default link behavior.
      setIsModalVisible(true); // Show the modal.
    },
    []
  );

  const handleCancel = useCallback(() => {
    setIsModalVisible(false); // Hide the modal.
  }, []);

  const handleConfirm = useCallback(() => {
    setIsModalVisible(false); // Hide the modal.
    window.open(href, '_blank'); // Open the link in a new tab.
  }, [href]);

  return (
    <>
      <ActionBase
        as="a"
        href={href}
        variant={variant}
        color={color}
        className={className}
        onClick={handleClick}
        {...rest}
      >
        {/* Slot allows for flexibility in button content, such as adding text or icons. */}
      </ActionBase>

      {isModalVisible && (
        <ConfirmModal
			show={false}
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
