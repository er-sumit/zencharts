import { BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { Coordinate } from '../model/coordinate';
import { PricedValue } from '../model/price-scale';
import { TimedValue } from '../model/time-data';

import { LinePoint, LineStyle, LineType, LineWidth } from './draw-line';
import { PaneRendererLineAreaBase, PaneRendererLineAreaBaseData } from './pane-renderer-line-area-base';

export type AreaFillItemBase = TimedValue & PricedValue & LinePoint;
export interface PaneRendererAreaDataBase<TItem extends AreaFillItemBase = AreaFillItemBase> extends PaneRendererLineAreaBaseData {
	items: TItem[];
	lineType: LineType;
	lineWidth: LineWidth;
	lineStyle: LineStyle;

	baseLevelCoordinate: Coordinate | null;
	invertFilledArea: boolean;

	barWidth: number;
}

function finishStyledArea(
	baseLevelCoordinate: Coordinate,
	scope: BitmapCoordinatesRenderingScope,
	style: CanvasRenderingContext2D['fillStyle'],
	areaFirstItem: LinePoint,
	newAreaFirstItem: LinePoint
): void {
	const { context, horizontalPixelRatio, verticalPixelRatio } = scope;
	context.lineTo(newAreaFirstItem.x * horizontalPixelRatio, baseLevelCoordinate * verticalPixelRatio);
	context.lineTo(areaFirstItem.x * horizontalPixelRatio, baseLevelCoordinate * verticalPixelRatio);
	context.closePath();
	context.fillStyle = style;
	context.fill();
}

export abstract class PaneRendererAreaBase<TData extends PaneRendererAreaDataBase> extends PaneRendererLineAreaBase<TData> {
	protected _drawImpl(renderingScope: BitmapCoordinatesRenderingScope): void {
		if (this._data === null) {
			return;
		}

		const baseLevelCoordinate =
			this._data.baseLevelCoordinate ??
				(this._data.invertFilledArea ? 0 : renderingScope.mediaSize.height) as Coordinate;

		if (this._data.visibleRange === null) {
			return;
		}

		this._walkLinePath(
			renderingScope,
			this._data,
			this._fillStyle.bind(this),
			finishStyledArea.bind(null, baseLevelCoordinate),
			true
		);
	}

	protected abstract _fillStyle(renderingScope: BitmapCoordinatesRenderingScope, item: TData['items'][0]): CanvasRenderingContext2D['fillStyle'];
}
