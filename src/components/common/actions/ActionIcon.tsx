// ActionIcon.tsx
import React from 'react';
import ActionBase from './ActionBase';
import type { ActionVariants, ActionColors, BaseActionVariants, IconVariants } from './ActionBase';
import Icon from '@/components/common/Icon';
import type { IconNames } from '@/config/landing.interface';

interface ActionIconProps extends React.HTMLAttributes<HTMLButtonElement | HTMLAnchorElement> {
  icon: IconNames;
  iconSize?: string;
  variant?: BaseActionVariants;
  iconVariant?: IconVariants;
  color?: ActionColors;
  as?: 'button' | 'a';
  href?: string;
  target?: '_self' | '_blank';
  className?: string;
}

const ActionIcon: React.FC<ActionIconProps> = ({
  icon,
  iconSize = 'w-6 h-6',
  variant,
  iconVariant,
  color = 'primary',
  as = variant === 'scroll' ? 'a' : 'button',
  href,
  target = '_self',
  className,
  children,
  ...rest
}) => {
  // Manejar variantes separadas para evitar conflictos de tipo
  const computedVariant: ActionVariants = iconVariant ?? (`icon-${variant}` as ActionVariants);

  return (
    <ActionBase
      as={as}
      href={as === 'a' ? href : undefined}
      variant={computedVariant}
      color={color}
      target={as === 'a' ? target : undefined}
      className={className}
      {...rest}
    >
      <Icon icon={icon} size={iconSize} />
      {children}
    </ActionBase>
  );
};

export default ActionIcon;
