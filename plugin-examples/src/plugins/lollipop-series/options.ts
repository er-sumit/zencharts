import {
	CustomSeriesOptions,
	customSeriesDefaultOptions,
} from 'zen-charts';

export interface LollipopSeriesOptions extends CustomSeriesOptions {
	lineWidth: number;
}

export const defaultOptions: LollipopSeriesOptions = {
	...customSeriesDefaultOptions,
	lineWidth: 2,
} as const;
