import type { MiddlewareHandler } from 'astro';

export const defineMiddleware = (fn: MiddlewareHandler) => fn;
