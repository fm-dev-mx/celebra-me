// src/core/interfaces/orderDetails.interface.ts

export interface OrderDetails {
	/** Order ID */
	orderId: number;

	/** Product name */
	productName: string;

	/** Quantity */
	quantity: number;
}
