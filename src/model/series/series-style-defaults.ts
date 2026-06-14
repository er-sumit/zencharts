import { LineStyle, LineType } from '../../renderers/draw-line';
import { LastPriceAnimationMode, SeriesLineStyleProperties } from '../series-options';

export const seriesLineStyleDefaults: SeriesLineStyleProperties = {
	lineStyle: LineStyle.Solid,
	lineWidth: 3,
	lineType: LineType.Simple,
	lineVisible: true,
	crosshairMarkerVisible: true,
	crosshairMarkerRadius: 4,
	crosshairMarkerBorderColor: '',
	crosshairMarkerBorderWidth: 2,
	crosshairMarkerBackgroundColor: '',
	lastPriceAnimation: LastPriceAnimationMode.Disabled,
	pointMarkersVisible: false,
};
