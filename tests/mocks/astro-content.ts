import { z } from 'zod';

export const getEntry = jest.fn();

export const getCollection = jest.fn();

export const defineCollection = <T>(collection: T): T => collection;

export { z };
