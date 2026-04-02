import type React from 'react';
import * as UIIcons from './ui';
import * as InvitationIcons from './invitation';
import * as SocialIcons from './social';

type IconComponent = React.FC<{
	size?: number | string;
	className?: string;
	style?: React.CSSProperties;
}>;

const MODULES = [UIIcons, InvitationIcons, SocialIcons] as const;

const ALIASES: Record<string, string> = {
	Map: 'MapLocationIcon',
	Envelope: 'EnvelopedIcon',
	Boot: 'BootSealIcon',
	boot: 'BootSealIcon',
	'western-hat': 'WesternHatIcon',
	taco: 'TacoIcon',
	tuba: 'TubaIcon',
	accordion: 'AccordionIcon',
	heel: 'HeelIcon',
};

export const iconRegistry: Record<string, IconComponent> = {};

for (const module of MODULES) {
	for (const [exportName, component] of Object.entries(module)) {
		iconRegistry[exportName] = component as IconComponent;

		if (exportName.endsWith('Icon')) {
			iconRegistry[exportName.slice(0, -4)] = component as IconComponent;
		}
	}
}

for (const [alias, target] of Object.entries(ALIASES)) {
	const component = iconRegistry[target];
	if (component) {
		iconRegistry[alias] = component;
	}
}

export function resolveIconComponent(name: string | undefined): IconComponent | null {
	if (!name) return null;
	return iconRegistry[name] || null;
}

export function hasIconName(name: string): boolean {
	return Boolean(resolveIconComponent(name));
}
