// src/core/types/handlers.d.ts

/**
 * Generic Handler type for API routes.
 * @template ContextType - The type of the context object.
 */
export type Handler<ContextType = any> = (context: ContextType) => Promise<Response> | Response;

/**
 * Generic Middleware type.
 * @template ContextType - The type of the context object.
 */
export type Middleware<ContextType = any> = (handler: Handler<ContextType>) => Handler<ContextType>;
