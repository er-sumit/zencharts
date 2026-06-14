import { ensureNotNull } from '../helpers/assertions';
import { Delegate } from '../helpers/delegate';
import { ISubscription } from '../helpers/isubscription';

import { IChartModelBase, TrackingModeExitMode } from '../model/chart-model';
import { Coordinate } from '../model/coordinate';
import { KineticAnimation } from '../model/kinetic-animation';
import { Point } from '../model/point';
import { TimePointIndex } from '../model/time-data';
import { TouchMouseEventData } from '../model/touch-mouse-event-data';
import { Pane } from '../model/pane';

import { IChartWidgetBase } from './chart-widget';
import { MouseEventHandlerEventBase, MouseEventHandlerMouseEvent, MouseEventHandlers, MouseEventHandlerTouchEvent, Position, TouchMouseEvent } from './mouse-event-handler';

const enum KineticScrollConstants {
	MinScrollSpeed = 0.2,
	MaxScrollSpeed = 7,
	DumpingCoeff = 0.997,
	ScrollMinMove = 15,
}

interface StartScrollPosition extends Point {
	timestamp: number;
	localX: Coordinate;
	localY: Coordinate;
}

export interface IPaneWidgetInteractionDelegate {
	chart(): IChartWidgetBase;
	state(): Pane | null;
	size(): { width: number; height: number };
}

export class PaneWidgetInteractionController implements MouseEventHandlers {
	private readonly _delegate: IPaneWidgetInteractionDelegate;

	private _startScrollingPos: StartScrollPosition | null = null;
	private _isScrolling: boolean = false;
	private _clicked: Delegate<TimePointIndex | null, Point, TouchMouseEventData> = new Delegate();
	private _dblClicked: Delegate<TimePointIndex | null, Point, TouchMouseEventData> = new Delegate();
	private _prevPinchScale: number = 0;
	private _longTap: boolean = false;
	private _startTrackPoint: Point | null = null;
	private _exitTrackingModeOnNextTry: boolean = false;
	private _initCrosshairPosition: Point | null = null;

	private _scrollXAnimation: KineticAnimation | null = null;

	public constructor(delegate: IPaneWidgetInteractionDelegate) {
		this._delegate = delegate;
	}

	public clicked(): ISubscription<TimePointIndex | null, Point, TouchMouseEventData> {
		return this._clicked;
	}

	public dblClicked(): ISubscription<TimePointIndex | null, Point, TouchMouseEventData> {
		return this._dblClicked;
	}

	public isTrackingMode(): boolean {
		return this._startTrackPoint !== null;
	}

	public mouseEnterEvent(event: MouseEventHandlerMouseEvent): void {
		if (!this._delegate.state()) {
			return;
		}
		this._onMouseEvent();
		const x = event.localX;
		const y = event.localY;
		this._setCrosshairPosition(x, y, event);
	}

	public mouseDownEvent(event: MouseEventHandlerMouseEvent): void {
		this._onMouseEvent();
		this._mouseTouchDownEvent();
		this._setCrosshairPosition(event.localX, event.localY, event);
	}

	public mouseMoveEvent(event: MouseEventHandlerMouseEvent): void {
		if (!this._delegate.state()) {
			return;
		}
		this._onMouseEvent();
		const x = event.localX;
		const y = event.localY;
		this._setCrosshairPosition(x, y, event);
	}

	public mouseClickEvent(event: MouseEventHandlerMouseEvent): void {
		if (this._delegate.state() === null) {
			return;
		}
		this._onMouseEvent();
		this._setCrosshairPosition(event.localX, event.localY, event);
		this._fireClickedDelegate(event);
	}

	public mouseDoubleClickEvent(event: MouseEventHandlerMouseEvent | MouseEventHandlerTouchEvent): void {
		if (this._delegate.state() === null) {
			return;
		}
		this._fireMouseClickDelegate(this._dblClicked, event);
	}

	public doubleTapEvent(event: MouseEventHandlerTouchEvent): void {
		this.mouseDoubleClickEvent(event);
	}

	public pressedMouseMoveEvent(event: MouseEventHandlerMouseEvent): void {
		this._onMouseEvent();
		this._pressedMouseTouchMoveEvent(event);
		this._setCrosshairPosition(event.localX, event.localY, event);
	}

	public mouseUpEvent(event: MouseEventHandlerMouseEvent): void {
		if (this._delegate.state() === null) {
			return;
		}
		this._onMouseEvent();

		this._longTap = false;

		this._endScroll(event);
	}

	public tapEvent(event: MouseEventHandlerTouchEvent): void {
		if (this._delegate.state() === null) {
			return;
		}
		this._fireClickedDelegate(event);
	}

	public longTapEvent(event: MouseEventHandlerTouchEvent): void {
		this._longTap = true;

		if (this._startTrackPoint === null) {
			const point: Point = { x: event.localX, y: event.localY };
			this._startTrackingMode(point, point, event);
		}
	}

	public mouseLeaveEvent(event: MouseEventHandlerMouseEvent): void {
		if (this._delegate.state() === null) {
			return;
		}
		this._onMouseEvent();

		this._model().setHoveredSource(null);
		this._clearCrosshairPosition();
	}

	public pinchStartEvent(): void {
		this._prevPinchScale = 1;
		this._model().stopTimeScaleAnimation();
	}

	public pinchEvent(middlePoint: Position, scale: number): void {
		if (!this._chart().options()['handleScale'].pinch) {
			return;
		}

		const zoomScale = (scale - this._prevPinchScale) * 5;
		this._prevPinchScale = scale;

		this._model().zoomTime(middlePoint.x as Coordinate, zoomScale);
	}

	public touchStartEvent(event: MouseEventHandlerTouchEvent): void {
		this._longTap = false;
		this._exitTrackingModeOnNextTry = this._startTrackPoint !== null;

		this._mouseTouchDownEvent();

		const crosshair = this._model().crosshairSource();
		if (this._startTrackPoint !== null && crosshair.visible()) {
			this._initCrosshairPosition = { x: crosshair.appliedX(), y: crosshair.appliedY() };
			this._startTrackPoint = { x: event.localX, y: event.localY };
		}
	}

	public touchMoveEvent(event: MouseEventHandlerTouchEvent): void {
		if (this._delegate.state() === null) {
			return;
		}

		const x = event.localX;
		const y = event.localY;
		if (this._startTrackPoint !== null) {
			// tracking mode: move crosshair
			this._exitTrackingModeOnNextTry = false;
			const origPoint = ensureNotNull(this._initCrosshairPosition);
			const newX = origPoint.x + (x - this._startTrackPoint.x) as Coordinate;
			const newY = origPoint.y + (y - this._startTrackPoint.y) as Coordinate;
			this._setCrosshairPosition(newX, newY, event);
			return;
		}

		this._pressedMouseTouchMoveEvent(event);
	}

	public touchEndEvent(event: MouseEventHandlerTouchEvent): void {
		if (this._chart().options().trackingMode.exitMode === TrackingModeExitMode.OnTouchEnd) {
			this._exitTrackingModeOnNextTry = true;
		}
		this._tryExitTrackingMode();
		this._endScroll(event);
	}

	private _fireClickedDelegate(event: MouseEventHandlerEventBase): void {
		this._fireMouseClickDelegate(this._clicked, event);
	}

	private _fireMouseClickDelegate(delegate: Delegate<TimePointIndex | null, Point, TouchMouseEventData>, event: MouseEventHandlerEventBase): void {
		const x = event.localX;
		const y = event.localY;
		if (delegate.hasListeners()) {
			delegate.fire(this._model().timeScale().coordinateToIndex(x), { x, y }, event);
		}
	}

	private _setCrosshairPosition(x: Coordinate, y: Coordinate, event: MouseEventHandlerEventBase): void {
		const size = this._delegate.size();
		x = Math.max(0, Math.min(x, size.width - 1)) as Coordinate;
		y = Math.max(0, Math.min(y, size.height - 1)) as Coordinate;

		this._model().setAndSaveCurrentPosition(x, y, event, ensureNotNull(this._delegate.state()));
	}

	private _clearCrosshairPosition(): void {
		this._model().clearCurrentPosition();
	}

	private _tryExitTrackingMode(): void {
		if (this._exitTrackingModeOnNextTry) {
			this._startTrackPoint = null;
			this._clearCrosshairPosition();
		}
	}

	private _startTrackingMode(startTrackPoint: Point, crossHairPosition: Point, event: MouseEventHandlerEventBase): void {
		this._startTrackPoint = startTrackPoint;
		this._exitTrackingModeOnNextTry = false;
		this._setCrosshairPosition(crossHairPosition.x, crossHairPosition.y, event);
		const crosshair = this._model().crosshairSource();
		this._initCrosshairPosition = { x: crosshair.appliedX(), y: crosshair.appliedY() };
	}

	private _model(): IChartModelBase {
		return this._chart().model();
	}

	private _chart(): IChartWidgetBase {
		return this._delegate.chart();
	}

	private _preventScroll(event: TouchMouseEvent): boolean {
		return event.isTouch && this._longTap || this._startTrackPoint !== null;
	}

	private _endScroll(event: TouchMouseEvent): void {
		if (!this._isScrolling) {
			return;
		}

		const model = this._model();
		const state = ensureNotNull(this._delegate.state());

		model.endScrollPrice(state, state.defaultPriceScale());

		this._startScrollingPos = null;
		this._isScrolling = false;
		model.endScrollTime();

		if (this._scrollXAnimation !== null) {
			const startAnimationTime = performance.now();
			const timeScale = model.timeScale();

			this._scrollXAnimation.start(timeScale.rightOffset() as Coordinate, startAnimationTime);

			if (!this._scrollXAnimation.finished(startAnimationTime)) {
				model.setTimeScaleAnimation(this._scrollXAnimation);
			}
		}
	}

	private _onMouseEvent(): void {
		this._startTrackPoint = null;
	}

	private _mouseTouchDownEvent(): void {
		if (!this._delegate.state()) {
			return;
		}

		this._model().stopTimeScaleAnimation();

		if (document.activeElement !== document.body && document.activeElement !== document.documentElement) {
			// If any focusable element except the page itself is focused, remove the focus
			(ensureNotNull(document.activeElement) as HTMLElement).blur();
		} else {
			// Clear selection
			const selection = document.getSelection();
			if (selection !== null) {
				selection.removeAllRanges();
			}
		}

		const priceScale = ensureNotNull(this._delegate.state()).defaultPriceScale();

		if (priceScale.isEmpty() || this._model().timeScale().isEmpty()) {
			return;
		}
	}

	// eslint-disable-next-line complexity
	private _pressedMouseTouchMoveEvent(event: TouchMouseEvent): void {
		if (this._delegate.state() === null) {
			return;
		}

		const model = this._model();
		const timeScale = model.timeScale();

		if (timeScale.isEmpty()) {
			return;
		}

		const chartOptions = this._chart().options();
		const scrollOptions = chartOptions['handleScroll'];
		const kineticScrollOptions = chartOptions.kineticScroll;
		if (
			(!scrollOptions.pressedMouseMove || event.isTouch) &&
			(!scrollOptions.horzTouchDrag && !scrollOptions.vertTouchDrag || !event.isTouch)
		) {
			return;
		}

		const state = ensureNotNull(this._delegate.state());
		const priceScale = state.defaultPriceScale();

		const now = performance.now();

		if (this._startScrollingPos === null && !this._preventScroll(event)) {
			this._startScrollingPos = {
				x: event.clientX,
				y: event.clientY,
				timestamp: now,
				localX: event.localX,
				localY: event.localY,
			};
		}

		if (
			this._startScrollingPos !== null &&
			!this._isScrolling &&
			(this._startScrollingPos.x !== event.clientX || this._startScrollingPos.y !== event.clientY)
		) {
			if (event.isTouch && kineticScrollOptions.touch || !event.isTouch && kineticScrollOptions.mouse) {
				const barSpacing = timeScale.barSpacing();
				this._scrollXAnimation = new KineticAnimation(
					KineticScrollConstants.MinScrollSpeed / barSpacing,
					KineticScrollConstants.MaxScrollSpeed / barSpacing,
					KineticScrollConstants.DumpingCoeff,
					KineticScrollConstants.ScrollMinMove / barSpacing
				);
				this._scrollXAnimation.addPosition(timeScale.rightOffset() as Coordinate, this._startScrollingPos.timestamp);
			} else {
				this._scrollXAnimation = null;
			}

			if (!priceScale.isEmpty()) {
				model.startScrollPrice(state, priceScale, event.localY);
			}

			model.startScrollTime(event.localX);
			this._isScrolling = true;
		}

		if (this._isScrolling) {
			// this allows scrolling not default price scales
			if (!priceScale.isEmpty()) {
				model.scrollPriceTo(state, priceScale, event.localY);
			}

			model.scrollTimeTo(event.localX);
			if (this._scrollXAnimation !== null) {
				this._scrollXAnimation.addPosition(timeScale.rightOffset() as Coordinate, now);
			}
		}
	}
}
