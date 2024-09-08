import React from 'react';
import type { IconNames } from '@/config/landing.interface';
import * as Icons from '@/components/icons'; // Import all icons from the icons directory

// Define the props interface, extending SVG attributes for flexibility
interface IconProps extends React.SVGProps<SVGSVGElement> {
  icon: IconNames; // Defines the type of icon to render
  size?: string; // Optional size control, e.g., Tailwind classes like "w-6 h-6"
  color?: string; // Main color of the icon, defaults to currentColor
  primaryColor?: string; // Optional primary color for dual-tone icons
  secondaryColor?: string; // Optional secondary color for dual-tone icons
}

// Map icon names to their respective components for easy access
const iconComponents: Record<IconNames, React.FC<React.SVGProps<SVGSVGElement>>> = {
  CommitmentIcon: Icons.CommitmentIcon,
  EasyUseIcon: Icons.EasyUseIcon,
  ExclusiveIcon: Icons.ExclusiveIcon,
  ArrowDownIcon: Icons.ArrowDownIcon,
  ArrowUpIcon: Icons.ArrowUpIcon,
  CelebrameIcon: Icons.CelebrameIcon,
  CheckIcon: Icons.CheckIcon,
  MenuIcon: Icons.MenuIcon,
  FavIcon: Icons.FavIcon,
  AnniversaryIcon: Icons.AnniversaryIcon,
  CakeIcon: Icons.CakeIcon,
  CrownIcon: Icons.CrownIcon,
  WeddingIcon: Icons.WeddingIcon,
  FacebookIcon: Icons.FacebookIcon,
  InstagramIcon: Icons.InstagramIcon,
  TikTokIcon: Icons.TikTokIcon,
  WhatsAppIcon: Icons.WhatsAppIcon,
  // Add more icons here as needed
};

// Functional component for rendering icons
const Icon: React.FC<IconProps> = ({
  icon,
  size = 'w-6 h-6', // Default size using Tailwind classes
  color = 'currentColor',
  primaryColor,
  secondaryColor,
  className,
  ...rest
}) => {
  // Retrieve the correct icon component based on the provided icon name
  const IconComponent = iconComponents[icon];

  // Combine classes for the icon
  const iconClasses = `${size} ${className || ''}`.trim();

  // Prepare icon-specific props
  const iconProps = {
    className: iconClasses,
    color,
    primaryColor,
    secondaryColor,
    ...rest,
  };

  // Render the icon if found, otherwise show a fallback error
  return IconComponent ? (
    <IconComponent {...iconProps} />
  ) : (
    <span className="text-red-500" title={`Icon not found: ${icon}`}>
      ⚠️
    </span>
  );
};

export default Icon;
