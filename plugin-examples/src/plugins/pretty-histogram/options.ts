import { customSeriesDefaultOptions, CustomSeriesOptions } from 'zen-charts';

export interface PrettyHistogramSeriesOptions extends CustomSeriesOptions {
	color: string;
	widthPercent: number;
	radius: number;
}

export const defaultOptions: PrettyHistogramSeriesOptions = {
	...customSeriesDefaultOptions,
	color: '#D63864',
	widthPercent: 50,
	radius: 4,
};
