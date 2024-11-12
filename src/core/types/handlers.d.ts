// src/types/handlers.d.ts
import type { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

export type APIRoute = (context: ContactFormAPIContext) => Promise<Response> | Response;
export type Handler = (context: ContactFormAPIContext) => Promise<Response> | Response;
export type Middleware = (handler: Handler) => Handler;
