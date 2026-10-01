export { errorResponse, jsonResponse } from '../../shared/http';

export const MEMORY_UPLOAD_CORS_HEADERS = {
	'Access-Control-Allow-Methods': 'OPTIONS, PUT',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-amz-checksum-sha256',
	'Access-Control-Max-Age': '300',
} as const;
