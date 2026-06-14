import { BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { SeriesItemsIndexesRange } from '../model/time-data';

import { BitmapCoordinatesPaneRenderer } from './bitmap-coordinates-pane-renderer';
import { getDashPatternLength, LinePoint, LineStyle, LineType, LineWidth, setLineStyle } from './draw-line';
import { walkLine } from './walk-line';

export interface PaneRendererLineAreaBaseData {
	visibleRange: SeriesItemsIndexesRange | null;
	items: readonly LinePoint[];
	lineType?: LineType;
	lineWidth: LineWidth;
	lineStyle: LineStyle;
	barWidth: number;
}

export abstract class PaneRendererLineAreaBase<TData extends PaneRendererLineAreaBaseData> extends BitmapCoordinatesPaneRenderer {
	protected _data: TData | null = null;

	public setData(data: TData): void {
		this._data = data;
	}

	protected _walkLinePath<TItem extends LinePoint, TStyle extends CanvasRenderingContext2D['fillStyle'] | CanvasRenderingContext2D['strokeStyle']>(
		renderingScope: BitmapCoordinatesRenderingScope,
		data: TData,
		styleGetter: (renderingScope: BitmapCoordinatesRenderingScope, item: TItem) => TStyle,
		finishStyledArea: (scope: BitmapCoordinatesRenderingScope, style: TStyle, areaFirstItem: LinePoint, newAreaFirstItem: LinePoint) => void,
		isArea: boolean
	): void {
		if (data.visibleRange === null) {
			return;
		}

		const ctx = renderingScope.context;

		ctx.lineCap = 'butt';
		ctx.lineJoin = 'round';

		ctx.lineWidth = isArea ? data.lineWidth : data.lineWidth * renderingScope.verticalPixelRatio;

		const dashPattern = setLineStyle(ctx, data.lineStyle);
		const dashPatternLength = getDashPatternLength(dashPattern);

		if (isArea) {
			ctx.lineWidth = 1;
		}

		if (data.lineType !== undefined) {
			walkLine(
				renderingScope,
				data.items as readonly TItem[],
				data.lineType,
				data.visibleRange,
				data.barWidth,
				styleGetter,
				finishStyledArea,
				dashPatternLength
			);
		}
	}
}
