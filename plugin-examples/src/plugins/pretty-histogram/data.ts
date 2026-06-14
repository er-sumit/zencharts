import { SeriesDataItemTypeMap, SingleValueData } from 'zen-charts';

export type PrettyHistogramData<HorzScaleItem> = SeriesDataItemTypeMap<HorzScaleItem>['Histogram'] & SingleValueData<HorzScaleItem>;
