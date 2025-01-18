// src/core/interfaces/rawData.interface.ts

import type { OrderDetails } from './orderDetails.interface';

export interface RawData {
	/** User's name */
	userName?: string;

	/** User's email */
	userEmail?: string;

	/** Transaction ID */
	transactionId?: string;

	/** Order details */
	orderDetails?: OrderDetails;
}
