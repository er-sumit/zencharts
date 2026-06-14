import { BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { PricedValue } from '../model/price-scale';
import { TimedValue } from '../model/time-data';

import { LinePoint, LineStyle, LineType, LineWidth } from './draw-line';
import { drawSeriesPointMarkers } from './draw-series-point-markers';
import { PaneRendererLineAreaBase, PaneRendererLineAreaBaseData } from './pane-renderer-line-area-base';

export type LineItemBase = TimedValue & PricedValue & LinePoint;

export interface PaneRendererLineDataBase<TItem extends LineItemBase = LineItemBase> extends PaneRendererLineAreaBaseData {
	lineType?: LineType;

	items: TItem[];

	barWidth: number;

	lineWidth: LineWidth;
	lineStyle: LineStyle;

	pointMarkersRadius?: number;
}

function finishStyledArea(scope: BitmapCoordinatesRenderingScope, style: CanvasRenderingContext2D['strokeStyle']): void {
	const ctx = scope.context;
	ctx.strokeStyle = style;
	ctx.stroke();
}

export abstract class PaneRendererLineBase<TData extends PaneRendererLineDataBase> extends PaneRendererLineAreaBase<TData> {
	protected _drawImpl(renderingScope: BitmapCoordinatesRenderingScope): void {
		if (this._data === null) {
			return;
		}

		const { items, visibleRange, pointMarkersRadius } = this._data;

		if (visibleRange === null) {
			return;
		}

		const styleGetter = this._strokeStyle.bind(this);

		this._walkLinePath(
			renderingScope,
			this._data,
			styleGetter,
			finishStyledArea,
			false
		);

		if (pointMarkersRadius) {
			drawSeriesPointMarkers(renderingScope, items, pointMarkersRadius, visibleRange, styleGetter);
		}
	}

	protected abstract _strokeStyle(renderingScope: BitmapCoordinatesRenderingScope, item: TData['items'][0]): CanvasRenderingContext2D['strokeStyle'];
}
