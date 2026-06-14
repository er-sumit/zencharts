import {
	BitmapCoordinatesRenderingScope,
	CanvasElementBitmapSizeBinding,
	CanvasRenderingTarget2D,
	equalSizes,
	Size,
	size,
	tryCreateCanvasRenderingTarget2D,
} from 'fancy-canvas';

import { ensureNotNull } from '../helpers/assertions';
import { clearRect, clearRectWithGradient } from '../helpers/canvas-helpers';

import { IDestroyable } from '../helpers/idestroyable';
import { ISubscription } from '../helpers/isubscription';

import { IChartModelBase } from '../model/chart-model';
import { Coordinate } from '../model/coordinate';
import { IDataSourcePaneViews } from '../model/idata-source';
import { InvalidationLevel } from '../model/invalidate-mask';
import { Pane } from '../model/pane';
import { hitTestPane, HitTestResult } from '../model/pane-hit-test';
import { Point } from '../model/point';
import { TimePointIndex } from '../model/time-data';
import { TouchMouseEventData } from '../model/touch-mouse-event-data';
import { IPaneRenderer } from '../renderers/ipane-renderer';
import { HoveredSourcePaneViews } from '../views/pane/hovered-source-pane-views';
import { IPaneView } from '../views/pane/ipane-view';

import { AttributionLogoWidget } from './attribution-logo-widget';
import { createBoundCanvas, releaseCanvas } from './canvas-utils';
import { IChartWidgetBase } from './chart-widget';
import { drawBackground, drawForeground, DrawFunction, drawPaneViews, drawSourceViews, ViewsGetter } from './draw-functions';
import { MouseEventHandler, MouseEventHandlerMouseEvent, MouseEventHandlers, MouseEventHandlerTouchEvent, Position } from './mouse-event-handler';
import { PriceAxisWidget, PriceAxisWidgetSide } from './price-axis-widget';
import { IPaneWidgetInteractionDelegate, PaneWidgetInteractionController } from './pane-widget-interaction-controller';



function sourceBottomPaneViews(source: IDataSourcePaneViews, pane: Pane): readonly IPaneView[] {
	return source.bottomPaneViews?.(pane) ?? [];
}
function sourcePaneViews(source: IDataSourcePaneViews, pane: Pane): readonly IPaneView[] {
	return source.paneViews?.(pane) ?? [];
}
function sourceLabelPaneViews(source: IDataSourcePaneViews, pane: Pane): readonly IPaneView[] {
	return source.labelPaneViews?.(pane) ?? [];
}
function sourceTopPaneViews(source: IDataSourcePaneViews, pane: Pane): readonly IPaneView[] {
	return source.topPaneViews?.(pane) ?? [];
}


export class PaneWidget implements IDestroyable, MouseEventHandlers, IPaneWidgetInteractionDelegate {
	private readonly _chart: IChartWidgetBase;
	private _state: Pane | null;
	private _size: Size = size({ width: 0, height: 0 });
	private _leftPriceAxisWidget: PriceAxisWidget | null = null;
	private _rightPriceAxisWidget: PriceAxisWidget | null = null;
	private _attributionLogoWidget: AttributionLogoWidget | null = null;
	private readonly _paneCell: HTMLElement;
	private readonly _leftAxisCell: HTMLElement;
	private readonly _rightAxisCell: HTMLElement;
	private readonly _canvasBinding: CanvasElementBitmapSizeBinding;
	private readonly _topCanvasBinding: CanvasElementBitmapSizeBinding;
	private readonly _rowElement: HTMLElement;
	private readonly _mouseEventHandler: MouseEventHandler;
	private readonly _interactionController: PaneWidgetInteractionController;

	private _isSettingSize: boolean = false;

	public constructor(chart: IChartWidgetBase, state: Pane) {
		this._chart = chart;

		this._state = state;
		this._state.onDestroyed().subscribe(this._onStateDestroyed.bind(this), this, true);

		this._paneCell = document.createElement('td');
		this._paneCell.style.padding = '0';
		this._paneCell.style.position = 'relative';

		const paneWrapper = document.createElement('div');
		paneWrapper.style.width = '100%';
		paneWrapper.style.height = '100%';
		paneWrapper.style.position = 'relative';
		paneWrapper.style.overflow = 'hidden';

		this._leftAxisCell = document.createElement('td');
		this._leftAxisCell.style.padding = '0';

		this._rightAxisCell = document.createElement('td');
		this._rightAxisCell.style.padding = '0';

		this._paneCell.appendChild(paneWrapper);

		this._canvasBinding = createBoundCanvas(paneWrapper, size({ width: 16, height: 16 }));
		this._canvasBinding.subscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
		const canvas = this._canvasBinding.canvasElement;
		canvas.style.position = 'absolute';
		canvas.style.zIndex = '1';
		canvas.style.left = '0';
		canvas.style.top = '0';

		this._topCanvasBinding = createBoundCanvas(paneWrapper, size({ width: 16, height: 16 }));
		this._topCanvasBinding.subscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
		const topCanvas = this._topCanvasBinding.canvasElement;
		topCanvas.style.position = 'absolute';
		topCanvas.style.zIndex = '2';
		topCanvas.style.left = '0';
		topCanvas.style.top = '0';
		topCanvas.tabIndex = -1;
		topCanvas.style.outline = 'none';
		topCanvas.addEventListener('keydown', this._handleKeyDown);

		this._rowElement = document.createElement('tr');
		this._rowElement.appendChild(this._leftAxisCell);
		this._rowElement.appendChild(this._paneCell);
		this._rowElement.appendChild(this._rightAxisCell);
		this.updatePriceAxisWidgetsStates();

		this._interactionController = new PaneWidgetInteractionController(this);

		this._mouseEventHandler = new MouseEventHandler(
			this._topCanvasBinding.canvasElement,
			this,
			{
				treatVertTouchDragAsPageScroll: () => !this._interactionController.isTrackingMode() && !this._chart.options()['handleScroll'].vertTouchDrag,
				treatHorzTouchDragAsPageScroll: () => !this._interactionController.isTrackingMode() && !this._chart.options()['handleScroll'].horzTouchDrag,
			}
		);
	}

	public destroy(): void {
		if (this._leftPriceAxisWidget !== null) {
			this._leftPriceAxisWidget.destroy();
		}
		if (this._rightPriceAxisWidget !== null) {
			this._rightPriceAxisWidget.destroy();
		}
		this._attributionLogoWidget = null;

		const topCanvas = this._topCanvasBinding.canvasElement;
		topCanvas.removeEventListener('keydown', this._handleKeyDown);

		this._topCanvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._topCanvasSuggestedBitmapSizeChangedHandler);
		releaseCanvas(this._topCanvasBinding.canvasElement);
		this._topCanvasBinding.dispose();

		this._canvasBinding.unsubscribeSuggestedBitmapSizeChanged(this._canvasSuggestedBitmapSizeChangedHandler);
		releaseCanvas(this._canvasBinding.canvasElement);
		this._canvasBinding.dispose();

		if (this._state !== null) {
			this._state.onDestroyed().unsubscribeAll(this);
			this._state.destroy();
		}

		this._mouseEventHandler.destroy();
	}

	public state(): Pane {
		return ensureNotNull(this._state);
	}

	public setState(pane: Pane | null): void {
		if (this._state !== null) {
			this._state.onDestroyed().unsubscribeAll(this);
		}

		this._state = pane;

		if (this._state !== null) {
			this._state.onDestroyed().subscribe(PaneWidget.prototype._onStateDestroyed.bind(this), this, true);
		}

		this.updatePriceAxisWidgetsStates();

		if (this._chart.paneWidgets().indexOf(this) === this._chart.paneWidgets().length - 1) {
			this._attributionLogoWidget = this._attributionLogoWidget ?? new AttributionLogoWidget(this._paneCell, this._chart);
			this._attributionLogoWidget.update();
		} else {
			this._attributionLogoWidget?.removeElement();
			this._attributionLogoWidget = null;
		}
	}

	public chart(): IChartWidgetBase {
		return this._chart;
	}

	public getElement(): HTMLElement {
		return this._rowElement;
	}

	public updatePriceAxisWidgetsStates(): void {
		if (this._state === null) {
			return;
		}

		this._recreatePriceAxisWidgets();
		if (this._model().serieses().length === 0) {
			return;
		}

		if (this._leftPriceAxisWidget !== null) {
			const leftPriceScale = this._state.leftPriceScale();
			this._leftPriceAxisWidget.setPriceScale(ensureNotNull(leftPriceScale));
		}
		if (this._rightPriceAxisWidget !== null) {
			const rightPriceScale = this._state.rightPriceScale();
			this._rightPriceAxisWidget.setPriceScale(ensureNotNull(rightPriceScale));
		}
	}

	public updatePriceAxisWidgets(): void {
		if (this._leftPriceAxisWidget !== null) {
			this._leftPriceAxisWidget.update();
		}
		if (this._rightPriceAxisWidget !== null) {
			this._rightPriceAxisWidget.update();
		}
	}

	public stretchFactor(): number {
		return this._state !== null ? this._state.stretchFactor() : 0;
	}

	public setStretchFactor(stretchFactor: number): void {
		if (this._state) {
			this._state.setStretchFactor(stretchFactor);
		}
	}

	public mouseEnterEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseEnterEvent(event);
	}

	public mouseDownEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseDownEvent(event);
	}

	public mouseMoveEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseMoveEvent(event);
	}

	public mouseClickEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseClickEvent(event);
	}

	public mouseDoubleClickEvent(event: MouseEventHandlerMouseEvent | MouseEventHandlerTouchEvent): void {
		this._interactionController.mouseDoubleClickEvent(event);
	}

	public doubleTapEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.doubleTapEvent(event);
	}

	public pressedMouseMoveEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.pressedMouseMoveEvent(event);
	}

	public mouseUpEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseUpEvent(event);
	}

	public tapEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.tapEvent(event);
	}

	public longTapEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.longTapEvent(event);
	}

	public mouseLeaveEvent(event: MouseEventHandlerMouseEvent): void {
		this._interactionController.mouseLeaveEvent(event);
	}

	public clicked(): ISubscription<TimePointIndex | null, Point, TouchMouseEventData> {
		return this._interactionController.clicked();
	}

	public dblClicked(): ISubscription<TimePointIndex | null, Point, TouchMouseEventData> {
		return this._interactionController.dblClicked();
	}

	public pinchStartEvent(): void {
		this._interactionController.pinchStartEvent();
	}

	public pinchEvent(middlePoint: Position, scale: number): void {
		this._interactionController.pinchEvent(middlePoint, scale);
	}

	public touchStartEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.touchStartEvent(event);
	}

	public touchMoveEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.touchMoveEvent(event);
	}

	public touchEndEvent(event: MouseEventHandlerTouchEvent): void {
		this._interactionController.touchEndEvent(event);
	}

	public interactionController(): PaneWidgetInteractionController {
		return this._interactionController;
	}


	public size(): { width: number; height: number } {
		return this._size;
	}

	public canvasElement(): HTMLCanvasElement {
		return this._topCanvasBinding.canvasElement;
	}

	private readonly _handleKeyDown = (event: KeyboardEvent): void => {
		if (this._state === null) {
			return;
		}

		const tag = document.activeElement?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') {
			return;
		}

		const consumed = this._interactionController.keyDownEvent(event);
		if (consumed) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	public hitTest(x: Coordinate, y: Coordinate): HitTestResult | null {
		const state = this._state;
		if (state === null) {
			return null;
		}

		return hitTestPane(state, x, y);
	}

	public setPriceAxisSize(width: number, position: PriceAxisWidgetSide): void {
		const priceAxisWidget = position === 'left' ? this._leftPriceAxisWidget : this._rightPriceAxisWidget;
		ensureNotNull(priceAxisWidget).setSize(size({ width, height: this._size.height }));
	}

	public getSize(): Size {
		return this._size;
	}

	public setSize(newSize: Size): void {
		if (equalSizes(this._size, newSize)) {
			return;
		}

		this._size = newSize;
		this._isSettingSize = true;
		this._canvasBinding.resizeCanvasElement(newSize);
		this._topCanvasBinding.resizeCanvasElement(newSize);
		this._isSettingSize = false;
		this._paneCell.style.width = newSize.width + 'px';
		this._paneCell.style.height = newSize.height + 'px';
	}

	public recalculatePriceScales(): void {
		const pane = ensureNotNull(this._state);
		pane.recalculatePriceScale(pane.leftPriceScale());
		pane.recalculatePriceScale(pane.rightPriceScale());

		for (const source of pane.dataSources()) {
			if (pane.isOverlay(source)) {
				const priceScale = source.priceScale();
				if (priceScale !== null) {
					pane.recalculatePriceScale(priceScale);
				}

				// for overlay drawings price scale is owner's price scale
				// however owner's price scale could not contain ds
				source.updateAllViews();
			}
		}
		for (const primitive of pane.primitives()) {
			primitive.updateAllViews();
		}
	}

	public getBitmapSize(): Size {
		return this._canvasBinding.bitmapSize;
	}

	public drawBitmap(ctx: CanvasRenderingContext2D, x: number, y: number, addTopLayer?: boolean): void {
		const bitmapSize = this.getBitmapSize();
		if (bitmapSize.width > 0 && bitmapSize.height > 0) {
			ctx.drawImage(this._canvasBinding.canvasElement, x, y);

			if (addTopLayer) {
				const topLayer = this._topCanvasBinding.canvasElement;
				if (ctx !== null) {
					ctx.drawImage(topLayer, x, y);
				}
			}
		}
	}

	public paint(type: InvalidationLevel): void {
		if (type === InvalidationLevel.None) {
			return;
		}

		if (this._state === null) {
			return;
		}

		if (type > InvalidationLevel.Cursor) {
			this.recalculatePriceScales();
		}

		if (this._leftPriceAxisWidget !== null) {
			this._leftPriceAxisWidget.paint(type);
		}
		if (this._rightPriceAxisWidget !== null) {
			this._rightPriceAxisWidget.paint(type);
		}

		const canvasOptions: CanvasRenderingContext2DSettings = {
			colorSpace: this._chart.options().layout.colorSpace,
		};

		if (type !== InvalidationLevel.Cursor) {
			this._canvasBinding.applySuggestedBitmapSize();
			const target = tryCreateCanvasRenderingTarget2D(this._canvasBinding, canvasOptions);
			if (target !== null) {
				target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
					this._drawBackground(scope);
				});
				if (this._state) {
					this._drawSources(target, sourceBottomPaneViews);
					this._drawGrid(target);
					this._drawSources(target, sourcePaneViews);
					this._drawSources(target, sourceLabelPaneViews);
				}
			}
		}

		this._topCanvasBinding.applySuggestedBitmapSize();
		const topTarget = tryCreateCanvasRenderingTarget2D(this._topCanvasBinding, canvasOptions);
		if (topTarget !== null) {
			topTarget.useBitmapCoordinateSpace(({ context: ctx, bitmapSize }: BitmapCoordinatesRenderingScope) => {
				ctx.clearRect(0, 0, bitmapSize.width, bitmapSize.height);
			});
			this._drawCrosshair(topTarget);
			this._drawSources(topTarget, sourceTopPaneViews);
			this._drawSources(topTarget, sourceLabelPaneViews);
		}
	}

	public leftPriceAxisWidget(): PriceAxisWidget | null {
		return this._leftPriceAxisWidget;
	}

	public rightPriceAxisWidget(): PriceAxisWidget | null {
		return this._rightPriceAxisWidget;
	}

	public drawAdditionalSources(target: CanvasRenderingTarget2D, paneViewsGetter: ViewsGetter<IDataSourcePaneViews>): void {
		this._drawSources(target, paneViewsGetter);
	}

	private _onStateDestroyed(): void {
		if (this._state !== null) {
			this._state.onDestroyed().unsubscribeAll(this);
		}

		this._state = null;
	}


	private _drawBackground({ context: ctx, bitmapSize }: BitmapCoordinatesRenderingScope): void {
		const { width, height } = bitmapSize;
		const model = this._model();
		const topColor = model.backgroundTopColor();
		const bottomColor = model.backgroundBottomColor();

		if (topColor === bottomColor) {
			clearRect(ctx, 0, 0, width, height, bottomColor);
		} else {
			clearRectWithGradient(ctx, 0, 0, width, height, topColor, bottomColor);
		}
	}

	private _drawGrid(target: CanvasRenderingTarget2D): void {
		const state = ensureNotNull(this._state);
		const paneView = state.grid().paneView();
		const renderer = paneView.renderer(state);

		if (renderer !== null) {
			renderer.draw(target, false);
		}
	}

	private _drawCrosshair(target: CanvasRenderingTarget2D): void {
		this._drawSourceImpl(target, sourcePaneViews, drawForeground, this._model().crosshairSource());
	}

	private _drawSources(target: CanvasRenderingTarget2D, paneViewsGetter: ViewsGetter<IDataSourcePaneViews>): void {
		const state = ensureNotNull(this._state);
		const hoveredSplitSource = paneViewsGetter === sourcePaneViews ? this._hoveredSplitSource() : null;
		const hoveredSplitViews = hoveredSplitSource === null ? null : this._hoveredSplitSourcePaneViews(hoveredSplitSource, state);

		const panePrimitives = state.primitives();
		if (hoveredSplitViews === null || hoveredSplitSource === null) {
			const sources = state.orderedSourcesForRendering();
			this._drawSourceGroup(target, paneViewsGetter, drawBackground, panePrimitives, sources);
			this._drawSourceGroup(target, paneViewsGetter, drawForeground, panePrimitives, sources);

			return;
		}

		const sources = state.orderedSources();
		const sourcePaneViewsOverride = (source: IDataSourcePaneViews): readonly IPaneView[] | undefined =>
			source === hoveredSplitSource ? hoveredSplitViews.normalPaneViews : undefined;
		this._drawSourceGroup(target, paneViewsGetter, drawBackground, panePrimitives, sources, sourcePaneViewsOverride);
		this._drawSourceGroup(target, paneViewsGetter, drawForeground, panePrimitives, sources, sourcePaneViewsOverride);

		this._drawSourceImpl(target, paneViewsGetter, drawBackground, hoveredSplitSource, hoveredSplitViews.topPaneViews);
		this._drawSourceImpl(target, paneViewsGetter, drawForeground, hoveredSplitSource, hoveredSplitViews.topPaneViews);
	}

	private _drawSourceGroup(
		target: CanvasRenderingTarget2D,
		paneViewsGetter: ViewsGetter<IDataSourcePaneViews>,
		drawFn: DrawFunction,
		panePrimitives: readonly IDataSourcePaneViews[],
		sources: readonly IDataSourcePaneViews[],
		sourcePaneViewsOverride?: (source: IDataSourcePaneViews) => readonly IPaneView[] | undefined
	): void {
		for (const panePrimitive of panePrimitives) {
			this._drawSourceImpl(target, paneViewsGetter, drawFn, panePrimitive);
		}

		if (sourcePaneViewsOverride === undefined) {
			for (const source of sources) {
				this._drawSourceImpl(target, paneViewsGetter, drawFn, source);
			}
			return;
		}

		for (const source of sources) {
			this._drawSourceImpl(target, paneViewsGetter, drawFn, source, sourcePaneViewsOverride(source));
		}
	}

	private _hoveredSplitSource(): IDataSourcePaneViews | null {
		const state = ensureNotNull(this._state);
		const hoveredSource = state.model().hoveredSource()?.source;

		if (
			!state.model().options().hoveredSeriesOnTop ||
			hoveredSource === undefined
		) {
			return null;
		}

		for (const source of state.orderedSources()) {
			if (source === hoveredSource) {
				return source;
			}
		}

		return null;
	}

	private _hoveredSplitSourcePaneViews(source: IDataSourcePaneViews, pane: Pane): HoveredSourcePaneViews | null {
		const hoveredPaneViews = source.paneViewsForHoveredSourceOnTop?.(pane) ?? null;
		if (hoveredPaneViews === null || hoveredPaneViews.topPaneViews.length === 0) {
			return null;
		}

		return hoveredPaneViews;
	}

	private _drawSourceImpl(
		target: CanvasRenderingTarget2D,
		paneViewsGetter: ViewsGetter<IDataSourcePaneViews>,
		drawFn: DrawFunction,
		source: IDataSourcePaneViews,
		paneViewsOverride?: readonly IPaneView[]
	): void {
		const state = ensureNotNull(this._state);
		const hoveredSource = state.model().hoveredSource();
		const isHovered = hoveredSource !== null && hoveredSource.source === source;
		const objecId = hoveredSource !== null && isHovered && hoveredSource.object !== undefined
			? hoveredSource.object.hitTestData
			: undefined;

		const drawRendererFn = (renderer: IPaneRenderer) => drawFn(renderer, target, isHovered, objecId);
		if (paneViewsOverride === undefined) {
			drawSourceViews(paneViewsGetter, drawRendererFn, source, state);
		} else {
			drawPaneViews(paneViewsOverride, drawRendererFn, state);
		}
	}

	private _recreatePriceAxisWidgets(): void {
		if (this._state === null) {
			return;
		}
		const chart = this._chart;
		const leftAxisVisible = this._state.leftPriceScale().options().visible;
		const rightAxisVisible = this._state.rightPriceScale().options().visible;
		if (!leftAxisVisible && this._leftPriceAxisWidget !== null) {
			this._leftAxisCell.removeChild(this._leftPriceAxisWidget.getElement());
			this._leftPriceAxisWidget.destroy();
			this._leftPriceAxisWidget = null;
		}
		if (!rightAxisVisible && this._rightPriceAxisWidget !== null) {
			this._rightAxisCell.removeChild(this._rightPriceAxisWidget.getElement());
			this._rightPriceAxisWidget.destroy();
			this._rightPriceAxisWidget = null;
		}
		const rendererOptionsProvider = chart.model().rendererOptionsProvider();
		if (leftAxisVisible && this._leftPriceAxisWidget === null) {
			this._leftPriceAxisWidget = new PriceAxisWidget(this, chart.options(), rendererOptionsProvider, 'left');
			this._leftAxisCell.appendChild(this._leftPriceAxisWidget.getElement());
		}
		if (rightAxisVisible && this._rightPriceAxisWidget === null) {
			this._rightPriceAxisWidget = new PriceAxisWidget(this, chart.options(), rendererOptionsProvider, 'right');
			this._rightAxisCell.appendChild(this._rightPriceAxisWidget.getElement());
		}
	}
	private _model(): IChartModelBase {
		return this._chart.model();
	}

	private readonly _canvasSuggestedBitmapSizeChangedHandler = () => {
		if (this._isSettingSize || this._state === null) {
			return;
		}

		this._model().lightUpdate();
	};

	private readonly _topCanvasSuggestedBitmapSizeChangedHandler = () => {
		if (this._isSettingSize || this._state === null) {
			return;
		}

		this._model().lightUpdate();
	};
}
