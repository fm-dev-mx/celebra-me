// src/core/interfaces/logging/requestMeta.interface.ts

export interface RequestMeta {
	/** Request ID */
	requestId?: string;

	/** Request URL */
	url: string;

	/** HTTP method */
	method: string;

	/** HTTP status code */
	statusCode?: number;

	/** Client IP address */
	clientIp?: string;
}
