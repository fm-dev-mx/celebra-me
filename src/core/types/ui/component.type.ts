// File: src/core/types/ui/component.types.ts

import React from 'react';

/**
 * Represents a type of element that can be rendered.
 * Supports both:
 * - Intrinsic HTML/SVG elements (e.g., 'div', 'a', 'button', etc.).
 * - Custom React components that accept children.
 *
 * @template P - Props type for custom React components (defaults to an empty object `{}`).
 */
export type ElementType<P = {}> =
	| keyof JSX.IntrinsicElements
	| React.JSXElementConstructor<React.PropsWithChildren<P>>;

/**
 * Adds specific props for the `as` prop.
 * Ensures type safety based on the value of the `as` prop:
 * - For `a`: Requires `href` and optionally allows `target`.
 * - For `button`: Allows `type` to specify the button's behavior.
 * - For other elements: Defaults to an empty object.
 *
 * @template T - The type of element specified by the `as` prop.
 */
type PropsWithAs<T extends ElementType> = T extends 'a'
	? { href: string; target?: string }
	: T extends 'button'
		? { type?: 'button' | 'submit' | 'reset' }
		: {};

/**
 * Combines props specific to the `as` element with the generic component props.
 * Ensures compatibility with React's `as` prop for flexible rendering.
 *
 * @template T - The type of element specified by the `as` prop.
 * @template P - Additional props specific to the component.
 */
export type ComponentPropsWithAs<T extends ElementType, P = {}> = PropsWithAs<T> &
	Omit<React.ComponentPropsWithRef<T>, 'as'> &
	P & {
		as?: T; // Allows specifying the element type to render
	};
