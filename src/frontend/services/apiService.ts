// src/frontend/services/apiService.ts

import { ContactFormFields } from '@/core/interfaces/forms/contactFormFields.interface';
import { ApiResponse } from '@/core/types/api/apiResponse.type';
import { jsonPost } from '@/frontend/utilities/apiClientUtils';
import { ClientApiError } from '@/core/errors/clientApiError';
import { getErrorMessage } from '@utilities/errorUtils';

class ApiService {
	static readonly MODULE_NAME = 'ApiService';
	public async sendContactForm(data: ContactFormFields): Promise<ApiResponse> {
		try {
			const response = await fetch('/api/contact-form-submissions', jsonPost(data));
			let responseData: ApiResponse;

			try {
				responseData = await response.json();
			} catch (parseError) {
				throw new ClientApiError(
					'Invalid response from server',
					ApiService.MODULE_NAME,
					parseError,
				);
			}

			if (!response.ok) {
				const errorMessage =
					responseData.message || `Error ${response.status}: ${response.statusText}`;
				throw new ClientApiError(errorMessage, ApiService.MODULE_NAME);
			}

			return responseData;
		} catch (error) {
			throw new ClientApiError(getErrorMessage(error), ApiService.MODULE_NAME, error);
		}
	}
}

export const apiService = new ApiService();
