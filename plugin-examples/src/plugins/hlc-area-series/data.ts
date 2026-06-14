import { CustomData } from 'zen-charts';

/**
 * HLCArea Series Data
 */
export interface HLCAreaData extends CustomData {
	high: number;
	low: number;
	close: number;
}
