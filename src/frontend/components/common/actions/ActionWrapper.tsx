// src/components/common/ActionWrapper.tsx
import React from 'react';

interface ActionWrapperProps {
  children: React.ReactNode;
  className?: string;
  variant?: string;
}

const ActionWrapper = ({ children, className = '', variant = '', ...rest }: ActionWrapperProps) => {
  // Combine the base class with variant and any additional class names
  const classes = `action-wrapper ${variant ? `action-wrapper-${variant}` : ''} ${className}`;

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

export default ActionWrapper;
