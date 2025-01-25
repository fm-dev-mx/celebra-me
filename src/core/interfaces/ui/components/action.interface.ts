// src/core/interfaces/ui/components/action.interface.ts

import type { IconNames } from '@/core/types/ui/iconNames.type';

export interface ActionProps {
	/**
	 * Text describing the action (used in UI or logs).
	 */
	label: string;

	/**
	 * Icon representing the action (optional).
	 */
	icon?: IconNames;

	/**
	 * Executes the action's logic.
	 */
	execute: () => void | Promise<void>;

	/**
	 * Short description of what the action does (for accessibility or tooltips).
	 */
	description?: string;

	/**
	 * Optional shortcut key combination to trigger the action.
	 */
	shortcut?: string;

	/**
	 * Indicates if the action is currently disabled.
	 */
	disabled?: boolean;

	/**
	 * Defines the role or type of the action (e.g., navigation, confirmation).
	 */
	type?: 'primary' | 'secondary' | 'danger' | 'info' | 'navigation';

	/**
	 * Additional metadata for the action.
	 */
	metadata?: Record<string, any>;
}
