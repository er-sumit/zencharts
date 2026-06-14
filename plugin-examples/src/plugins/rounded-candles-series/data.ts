import {
	CandlestickData,
	CustomData,
} from 'zen-charts';

export interface RoundedCandleSeriesData
	extends CandlestickData,
		CustomData {
	rounded?: boolean;
}
