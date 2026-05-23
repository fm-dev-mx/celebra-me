export const SUPPORTED_COUNTRY_CODES = ['+52', '+34', '+1'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];
export const DEFAULT_COUNTRY_CODE = '+52';

export interface CountryOption {
	value: string;
	label: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = SUPPORTED_COUNTRY_CODES.map((code) => ({
	value: code,
	label: code,
}));
