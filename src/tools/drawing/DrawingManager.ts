import type { IChartApi } from '../../api/create-chart';
import type { ISeriesApi } from '../../api/iseries-api';
import type { SeriesType } from '../../model/series-options';
import type { MouseEventParams } from '../../api/ichart-api';
import type { Time } from '../../model/horz-scale-behavior-time/types';
import type { DrawingPrimitive, Drawing, DrawingPoint, DrawingOptions } from './DrawingPrimitive';
import { IDrawingInteractionDelegate } from '../../gui/pane-widget-interaction-controller';
import { MouseEventHandlerMouseEvent, MouseEventHandlerTouchEvent } from '../../gui/mouse-event-handler';

type DragMode = 'handle' | 'body' | null;

export interface DrawingStatePayload {
	version: number;
	drawings: Drawing[];
}

export class DrawingManager implements IDrawingInteractionDelegate {
	private _chart: IChartApi;
	private _series: ISeriesApi<SeriesType>;
	private _primitive: DrawingPrimitive;
	private _activeTool: string | null = null;
	private _currentDrawing: Drawing | null = null;
	private _lockedPointsCount = 0;
	private _drawingsChangeCallbacks: ((drawings: Drawing[]) => void)[] = [];

	private _crosshairTime: Time | null = null;
	private _crosshairPrice: number | null = null;
	private _rawCrosshairPrice: number | null = null;

	// Dragging state
	private _dragMode: DragMode = null;
	private _draggedDrawingId: string | null = null;
	private _draggedPointIndex: number | null = null;

	// Body drag: stores the offsets from the drawing points to the cursor at drag start
	private _bodyDragOffsets: { useLogical: boolean; dLogical?: number; dTime?: number; dPrice: number }[] = [];

	// Snapping / Toolbar state
	private _isLocked = false;
	private _isHidden = false;
	private _magnetMode: 'off' | 'weak' | 'strong' = 'off';
	private _weakMagnetThresholdPx = 30;
	private _isTouchActive = false;
	private _inTouchFlow = false;
	private _seriesData: any[] = [];
	private _hoveredDrawingId: string | null = null;
	private _lastBrushScreenPoint: { x: number, y: number } | null = null;
	private _suppressToolCreation = false;

	private _chartElement: HTMLElement;

	constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, primitive: DrawingPrimitive) {
		this._chart = chart;
		this._series = series;
		this._primitive = primitive;
		this._chartElement = chart.chartElement();

		this._chart.subscribeClick(this._handleChartClick);
		this._chart.subscribeCrosshairMove(this._handleCrosshairMove);

		const chartWidget = (chart as any)._chartWidget;
		if (chartWidget) {
			const mainPaneWidget = chartWidget.paneWidgets()[0];
			if (mainPaneWidget) {
				mainPaneWidget.interactionController().setDrawingDelegate(this);
			}
		}
	}

	public destroy() {
		this._chart.unsubscribeClick(this._handleChartClick);
		this._chart.unsubscribeCrosshairMove(this._handleCrosshairMove);

		const chartWidget = (this._chart as any)._chartWidget;
		if (chartWidget) {
			const mainPaneWidget = chartWidget.paneWidgets()[0];
			if (mainPaneWidget) {
				mainPaneWidget.interactionController().setDrawingDelegate(null);
			}
		}
	}

	public setSeriesData(data: any[]) {
		this._seriesData = data;
		this._primitive.seriesData = data;
	}

	public get isLocked(): boolean {
		return this._isLocked;
	}
	public setLocked(locked: boolean) {
		this._isLocked = locked;
		this._primitive.isLocked = locked;
		if (locked) {
			this._primitive.hoveredPointInfo = null;
			this._chartElement.style.cursor = '';
		}
		this._primitive.updateAllViews();
	}

	public get isHidden(): boolean {
		return this._isHidden;
	}
	public setHidden(hidden: boolean) {
		this._isHidden = hidden;
		this._primitive.isHidden = hidden;
		this._primitive.updateAllViews();
	}

	public get isMagnetMode(): boolean {
		return this._magnetMode !== 'off';
	}
	public setMagnetMode(enabled: boolean) {
		this._magnetMode = enabled ? 'strong' : 'off';
	}

	public get magnetMode(): 'off' | 'weak' | 'strong' {
		return this._magnetMode;
	}
	public setMagnetModeType(mode: 'off' | 'weak' | 'strong') {
		this._magnetMode = mode;
	}

	public get weakMagnetThresholdPx(): number {
		return this._weakMagnetThresholdPx;
	}
	public setWeakMagnetThresholdPx(threshold: number) {
		this._weakMagnetThresholdPx = threshold;
	}

	private _getHitRadius(isHandle: boolean): number {
		if (this._isTouchActive) {
			return isHandle ? 22 : 20;
		}
		return isHandle ? 8 : 10;
	}

	public setTool(tool: string | null) {
		if (this._isLocked && tool !== null) {
			this._activeTool = null;
			this._notifyToolChange();
			return;
		}

		if (this._activeTool === 'measure' && tool !== 'measure') {
			this._deselectAll();
		}
		this._activeTool = tool;

		// Cancel any in-progress drawing
		if (this._currentDrawing) {
			this._primitive.drawings = this._primitive.drawings.filter(d => d.id !== this._currentDrawing!.id);
			this._currentDrawing = null;
			this._lockedPointsCount = 0;
			this._primitive.updateAllViews();
		}

		if (tool) {
			this._deselectAll();
			this._disableChartNavigation();
		} else {
			this._restoreChartNavigation();
		}

		this._updateCursor();
	}

	public get activeTool() {
		return this._activeTool;
	}

	public get drawings() {
		return this._primitive.drawings;
	}

	public setDrawings(drawings: Drawing[]) {
		this._primitive.drawings = drawings;
		this._primitive.updateAllViews();
		this._notifyChange();
	}

	public exportDrawings(): DrawingStatePayload {
		return {
			version: 1,
			drawings: this.drawings.map(d => ({
				id: d.id,
				type: d.type,
				points: d.points.map(p => ({
					time: p.time,
					price: p.price
				})),
				options: { ...d.options }
			}))
		};
	}

	public importDrawings(payload: DrawingStatePayload): void {
		if (!payload || typeof payload !== 'object') {
			this.setDrawings([]);
			return;
		}

		let rawDrawings: any[] = [];
		if (payload.version === 1 && Array.isArray(payload.drawings)) {
			rawDrawings = payload.drawings;
		} else if (Array.isArray(payload)) {
			// Fallback for legacy format or raw array
			rawDrawings = payload as any[];
		} else if (payload.drawings && Array.isArray(payload.drawings)) {
			rawDrawings = payload.drawings;
		}

		const validated: Drawing[] = [];
		for (const rd of rawDrawings) {
			if (!rd || typeof rd !== 'object') continue;
			const id = typeof rd.id === 'string' && rd.id ? rd.id : Math.random().toString(36).substring(2, 9);
			const type = typeof rd.type === 'string' ? rd.type : '';
			if (!type) continue;
			const points = Array.isArray(rd.points) ? rd.points.filter((p: any) => p && p.time !== undefined && typeof p.price === 'number') : [];
			const options = rd.options && typeof rd.options === 'object' ? { ...rd.options } : {};
			
			validated.push({
				id,
				type,
				points,
				options,
				selected: false
			});
		}
		this.setDrawings(validated);
	}

	public onDrawingsChange(callback: (drawings: Drawing[]) => void) {
		this._drawingsChangeCallbacks.push(callback);
		return () => {
			this._drawingsChangeCallbacks = this._drawingsChangeCallbacks.filter(cb => cb !== callback);
		};
	}

	public deleteSelected() {
		const selectedLocked = this.drawings.filter(d => d.selected && (this._isLocked || d.options.locked));
		if (selectedLocked.length > 0) {
			const hasConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function';
			const confirm = hasConfirm ? window.confirm("You are deleting a locked drawing. Are you sure?") : false;
			if (!confirm) return;
		}
		const updated = this.drawings.filter(d => !d.selected);
		this.setDrawings(updated);
	}

	public clearAll() {
		const hasLocked = this._isLocked || this.drawings.some(d => d.options.locked);
		if (hasLocked) {
			const hasConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function';
			const confirm = hasConfirm ? window.confirm("You have locked drawings. Are you sure you want to clear all drawings?") : false;
			if (!confirm) return;
		}
		this.setDrawings([]);
	}

	public updateSelectedOptions(options: Partial<DrawingOptions>) {
		const updated = this.drawings.map(d => {
			if (d.selected) {
				return {
					...d,
					options: {
						...d.options,
						...options
					}
				};
			}
			return d;
		});
		this.setDrawings(updated);
	}

	private _notifyChange() {
		this._drawingsChangeCallbacks.forEach(cb => cb(this.drawings));
	}

	private _deselectAll() {
		let changed = false;
		const updated = this.drawings.map(d => {
			if (d.selected) {
				changed = true;
				return { ...d, selected: false };
			}
			return d;
		});
		if (changed) {
			this.setDrawings(updated);
		}
	}

	private _disableChartNavigation() {
		this._chart.applyOptions({
			handleScroll: {
				mouseWheel: false,
				pressedMouseMove: false,
				horzTouchDrag: false,
				vertTouchDrag: false,
			},
			handleScale: {
				mouseWheel: false,
				pinch: false,
				axisPressedMouseMove: false,
			}
		});
	}

	private _restoreChartNavigation() {
		this._chart.applyOptions({
			handleScroll: {
				mouseWheel: true,
				pressedMouseMove: true,
				horzTouchDrag: true,
				vertTouchDrag: true,
			},
			handleScale: {
				mouseWheel: true,
				pinch: true,
				axisPressedMouseMove: true,
			}
		});
	}

	private _updateCursor() {
		if (this._activeTool) {
			this._chartElement.style.cursor = 'crosshair';
		} else if (this._dragMode === 'handle') {
			this._chartElement.style.cursor = 'nwse-resize';
		} else if (this._dragMode === 'body') {
			this._chartElement.style.cursor = 'grabbing';
		} else {
			this._chartElement.style.cursor = '';
		}
	}

	private _handleCrosshairMove = (param: MouseEventParams) => {
		if (param.point) {
			const timeScale = this._chart.timeScale();
			const logical = timeScale.coordinateToLogical(param.point.x);
			if (logical !== null) {
				const calculatedTime = this._logicalToTime(logical);
				if (calculatedTime) {
					this._crosshairTime = calculatedTime;
				}
			} else if (param.time) {
				this._crosshairTime = param.time;
			}

			let price = this._series.coordinateToPrice(param.point.y);
			this._rawCrosshairPrice = price;
			if (price !== null) {
				if (this._magnetMode !== 'off' && this._crosshairTime && this._seriesData.length > 0) {
					const candle = this._seriesData.find(d => d.time === this._crosshairTime);
					if (candle) {
						const prices = [candle.open, candle.high, candle.low, candle.close];
						let closest = prices[0];
						let minDist = Math.abs(price - closest);
						for (let i = 1; i < prices.length; i++) {
							const dist = Math.abs(price - prices[i]);
							if (dist < minDist) {
								minDist = dist;
								closest = prices[i];
							}
						}

						if (this._magnetMode === 'strong') {
							price = closest;
						} else if (this._magnetMode === 'weak') {
							const closestY = this._series.priceToCoordinate(closest);
							if (closestY !== null) {
								const distPx = Math.abs(param.point.y - closestY);
								if (distPx <= this._weakMagnetThresholdPx) {
									price = closest;
								}
							}
						}
					}
				}
				this._crosshairPrice = price;
			} else {
				this._rawCrosshairPrice = null;
			}

			// Update drawing preview while placing
			if (this._activeTool && this._currentDrawing) {
				const points = [...this._currentDrawing.points];
				const currentPoint: DrawingPoint = {
					time: this._crosshairTime || param.time || 0 as any,
					price: this._crosshairPrice || 0
				};

				if (this._activeTool === 'brush') {
					points.push(currentPoint);
					this._currentDrawing.points = points;
				} else {
					if (this._lockedPointsCount === 1) {
						points[1] = currentPoint;
					} else if (this._lockedPointsCount === 2 && this._requiresThreePoints(this._activeTool)) {
						points[2] = currentPoint;
					}
					this._currentDrawing.points = points;
					if (this._activeTool === 'measure') {
						this._updateMeasureText(this._currentDrawing);
					}
				}

				this._primitive.updateAllViews();
			}
		}

		// Handle hover detection for cursor feedback and hovered handle
		if (!this._activeTool && !this._dragMode && param.point && !this._isLocked) {
			this._checkHoveredPoint(param.point.x, param.point.y);
			this._checkHoveredBody(param.point.x, param.point.y);
		}
	};

	private _requiresThreePoints(tool: string): boolean {
		return tool === 'triangle' || tool === 'parallel_channel' || tool === 'rotated_rectangle';
	}

	private _handleChartClick = (param: MouseEventParams) => {

		const clickTime = this._crosshairTime || param.time;
		if (this._suppressToolCreation) {
			this._suppressToolCreation = false;
			return;
		}
		if (!this._activeTool || !param.point || !clickTime || this._crosshairPrice === null) return;

		const clickPoint: DrawingPoint = {
			time: clickTime,
			price: this._crosshairPrice
		};

		if (!this._currentDrawing) {
			// Start new drawing
			const newDrawing: Drawing = {
				id: Math.random().toString(36).substring(2, 9),
				type: this._activeTool,
				points: [clickPoint],
				options: {
					lineColor: this._activeTool === 'measure' ? '#26a69a' : '#2962ff',
					fillColor: this._activeTool === 'measure' ? 'rgba(38, 166, 154, 0.15)' : 'rgba(41, 98, 255, 0.15)',
					width: this._activeTool === 'measure' ? 1 : 2,
					showLabels: true,
					text: this._activeTool === 'text' ? 'Text Label' : (this._activeTool === 'measure' ? '' : undefined)
				}
			};
			this._currentDrawing = newDrawing;
			this._primitive.drawings.push(newDrawing);
			this._primitive.updateAllViews();
			this._lockedPointsCount = 1;

			// Single-click tools
			if (this._activeTool === 'text' || this._activeTool === 'horizontal' ||
				this._activeTool === 'vertical' || this._activeTool === 'cross') {
				this._finalizeDrawing();
			}
		} else {
			const points = [...this._currentDrawing.points];
			const reqPoints = this._requiresThreePoints(this._activeTool) ? 3 : 2;

			if (this._lockedPointsCount === 1) {
				points[1] = clickPoint;
				this._currentDrawing.points = points;
				if (this._activeTool === 'measure') {
					this._updateMeasureText(this._currentDrawing);
				}
				this._lockedPointsCount = 2;
				if (reqPoints === 2) {
					this._finalizeDrawing();
				} else {
					this._primitive.updateAllViews();
				}
			} else if (this._lockedPointsCount === 2 && reqPoints === 3) {
				points[2] = clickPoint;
				this._currentDrawing.points = points;
				this._lockedPointsCount = 3;
				this._finalizeDrawing();
			}
		}
	};

	// For notifying App that tool changed (measure tool auto-deselects)
	private _toolChangeCallbacks: ((tool: string | null) => void)[] = [];
	public onToolChange(cb: (tool: string | null) => void) {
		this._toolChangeCallbacks.push(cb);
		return () => { this._toolChangeCallbacks = this._toolChangeCallbacks.filter(x => x !== cb); };
	}
	private _notifyToolChange() {
		this._toolChangeCallbacks.forEach(cb => cb(this._activeTool));
	}

	private _finalizeDrawing() {
		if (this._currentDrawing) {
			this._currentDrawing.selected = true;
			this._currentDrawing = null;
			this._lockedPointsCount = 0;
			this._restoreChartNavigation();

			this._activeTool = null;
			this._notifyToolChange();

			this._updateCursor();
			this._primitive.updateAllViews();
			this._notifyChange();
		}
	}

	private _updateCurrentTimeAndPrice(localX: number, localY: number): void {
		const pt = this._coordsToPoint(localX, localY);
		if (pt) {
			this._crosshairTime = pt.time;
			let price = pt.price;
			if (this._magnetMode !== 'off' && this._crosshairTime && this._seriesData.length > 0) {
				const candle = this._seriesData.find(d => d.time === this._crosshairTime);
				if (candle) {
					const prices = [candle.open, candle.high, candle.low, candle.close];
					let closest = prices[0];
					let minDist = Math.abs(price - closest);
					for (let i = 1; i < prices.length; i++) {
						const dist = Math.abs(price - prices[i]);
						if (dist < minDist) {
							minDist = dist;
							closest = prices[i];
						}
					}

					if (this._magnetMode === 'strong') {
						price = closest;
					} else if (this._magnetMode === 'weak') {
						const closestY = this._series.priceToCoordinate(closest);
						if (closestY !== null) {
							const distPx = Math.abs(localY - closestY);
							if (distPx <= this._weakMagnetThresholdPx) {
								price = closest;
							}
						}
					}
				}
			}
			this._crosshairPrice = price;
		}
	}

	public mouseDownEvent(event: MouseEventHandlerMouseEvent): boolean {
		if (!this._inTouchFlow) {
			this._isTouchActive = false;
		}
		this._updateCurrentTimeAndPrice(event.localX, event.localY);

		const isDrawingMidway = this._activeTool && this._currentDrawing && this._activeTool !== 'brush';

		const mouseX = event.localX;
		const mouseY = event.localY;

		// 1. Prioritize handle selection (both hoveredPointInfo and synchronous hit check)
		let handleInfo: { drawingId: string; pointIndex: number } | null = null;

		if (this._primitive.hoveredPointInfo && !this._isLocked) {
			const d = this.drawings.find(dr => dr.id === this._primitive.hoveredPointInfo!.drawingId);
			if (d && d.selected && !d.options.locked) {
				handleInfo = this._primitive.hoveredPointInfo;
			}
		}

		if (!handleInfo && !this._isLocked) {
			const handleRadius = this._getHitRadius(true);
			// Find if click/touch hit any selection handle of any selected drawing (traversed in reverse to prioritize top-most)
			for (let i = this.drawings.length - 1; i >= 0; i--) {
				const d = this.drawings[i];
				if (!d.selected || d.options.locked) continue;
				const pts = this._primitive.renderedPoints.get(d.id);
				if (!pts) continue;
				for (let j = 0; j < pts.length; j++) {
					const p = pts[j];
					const dist = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2);
					if (dist < handleRadius) {
						handleInfo = { drawingId: d.id, pointIndex: j };
						break;
					}
				}
				if (handleInfo) break;
			}
		}

		if (handleInfo) {
			const activeId = handleInfo.drawingId;
			const targetDrawing = this.drawings.find(d => d.id === activeId);
			if (targetDrawing && !targetDrawing.options?.locked) {
				const ptIdx = handleInfo.pointIndex;
				if (targetDrawing.type === 'trendline' && ptIdx === 2) {
					this._dragMode = 'body';
					this._draggedDrawingId = activeId;
					this._draggedPointIndex = null;
					this._disableChartNavigation();
					this._updateCursor();

					if (this._crosshairTime !== null && this._rawCrosshairPrice !== null) {
						const cursorLogical = this._timeToLogical(this._crosshairTime);
						const cursorTimeNum = this._timeToNumber(this._crosshairTime);
						this._bodyDragOffsets = targetDrawing.points.map(p => {
							const pLogical = cursorLogical !== null ? this._timeToLogical(p.time) : null;
							if (pLogical !== null && cursorLogical !== null) {
								return {
									useLogical: true,
									dLogical: pLogical - cursorLogical,
									dPrice: p.price - this._rawCrosshairPrice!
								};
							} else {
								return {
									useLogical: false,
									dTime: this._timeToNumber(p.time) - cursorTimeNum,
									dPrice: p.price - this._rawCrosshairPrice!
								};
							}
						});
					}
					if (!isDrawingMidway) this._suppressToolCreation = true;
					return true;
				}

				this._dragMode = 'handle';
				this._draggedDrawingId = activeId;
				this._draggedPointIndex = ptIdx;
				this._disableChartNavigation();
				this._updateCursor();
				if (!isDrawingMidway) this._suppressToolCreation = true;
				return true;
			}
		}

		// 2. Body hit testing - iterate backwards to select top-most rendered drawing first
		let hitDrawing: Drawing | null = null;
		for (let i = this.drawings.length - 1; i >= 0; i--) {
			const d = this.drawings[i];
			const pts = this._primitive.renderedPoints.get(d.id);
			if (!pts || pts.length === 0) continue;
			if (this._isPointHitOnDrawing(mouseX, mouseY, pts, d)) {
				hitDrawing = d;
				break;
			}
		}

		if (hitDrawing) {
			let changed = false;
			const updated = this.drawings.map(d => {
				const shouldSelect = d.id === hitDrawing!.id;
				if (d.selected !== shouldSelect) {
					changed = true;
					return { ...d, selected: shouldSelect };
				}
				return d;
			});
			if (changed) {
				this.drawings = updated;
				this._primitive.updateAllViews();
			}

			if (!this._isLocked && !hitDrawing.options.locked) {
				this._dragMode = 'body';
				this._draggedDrawingId = hitDrawing.id;
				this._draggedPointIndex = null;
				this._disableChartNavigation();
				this._updateCursor();

				if (this._crosshairTime !== null && this._rawCrosshairPrice !== null) {
					const cursorLogical = this._timeToLogical(this._crosshairTime);
					const cursorTimeNum = this._timeToNumber(this._crosshairTime);
					this._bodyDragOffsets = hitDrawing.points.map(p => {
						const pLogical = cursorLogical !== null ? this._timeToLogical(p.time) : null;
						if (pLogical !== null && cursorLogical !== null) {
							return {
								useLogical: true,
								dLogical: pLogical - cursorLogical,
								dPrice: p.price - this._rawCrosshairPrice!
							};
						} else {
							return {
								useLogical: false,
								dTime: this._timeToNumber(p.time) - cursorTimeNum,
								dPrice: p.price - this._rawCrosshairPrice!
							};
						}
					});
				}
			}

			if (!isDrawingMidway) this._suppressToolCreation = true;
			return true;
		} else {
			this._deselectAll();
			return false;
		}
	}

	public mouseMoveEvent(event: MouseEventHandlerMouseEvent): boolean {
		if (!this._inTouchFlow) {
			this._isTouchActive = false;
		}
		this._updateCurrentTimeAndPrice(event.localX, event.localY);
		if (this._activeTool) {
			return true;
		}
		return false;
	}

	private _handleDragMove(): void {
		if (this._dragMode === 'handle' && this._draggedDrawingId !== null && this._draggedPointIndex !== null) {
			if (this._crosshairTime && this._crosshairPrice !== null) {
				const updated = this.drawings.map(d => {
					if (d.id === this._draggedDrawingId) {
						const points = [...d.points];
						if (d.type === 'rotated_rectangle' || d.type === 'parallel_channel') {
							const p1 = d.points[0];
							const p2 = d.points[1];
							const p3 = d.points[2];
							const timeScale = this._chart.timeScale();
							const cp1_x = this._primitive.timeToX(p1.time, timeScale);
							const cp1_y = this._series.priceToCoordinate(p1.price);
							const cp2_x = this._primitive.timeToX(p2.time, timeScale);
							const cp2_y = this._series.priceToCoordinate(p2.price);
							const cp3_x = p3 ? this._primitive.timeToX(p3.time, timeScale) : null;
							const cp3_y = p3 ? this._series.priceToCoordinate(p3.price) : null;

							const cursorX = this._primitive.timeToX(this._crosshairTime!, timeScale);
							const cursorY = this._series.priceToCoordinate(this._crosshairPrice!);

							if (
								cp1_x !== null && cp1_y !== null &&
								cp2_x !== null && cp2_y !== null &&
								cursorX !== null && cursorY !== null
							) {
								const dx = cp2_x - cp1_x;
								const dy = cp2_y - cp1_y;
								const len = Math.sqrt(dx * dx + dy * dy);

								if (len !== 0) {
									const px = -dy / len;
									const py = dx / len;

									const h_old = (cp3_x !== null && cp3_y !== null)
										? (cp3_x - cp1_x) * px + (cp3_y - cp1_y) * py
										: 0;

									if (this._draggedPointIndex === 0) {
										// Dragging hp1 (Corner 1)
										const dx_new = cp2_x - cursorX;
										const dy_new = cp2_y - cursorY;
										const len_new = Math.sqrt(dx_new * dx_new + dy_new * dy_new);
										if (len_new !== 0) {
											const px_new = -dy_new / len_new;
											const py_new = dx_new / len_new;
											const p3_new_x = cursorX + px_new * h_old;
											const p3_new_y = cursorY + py_new * h_old;

											const pt0 = this._coordsToPoint(cursorX, cursorY);
											const pt2 = this._coordsToPoint(p3_new_x, p3_new_y);
											if (pt0 && pt2) {
												points[0] = pt0;
												points[2] = pt2;
											}
										}
									} else if (this._draggedPointIndex === 1) {
										// Dragging hp2 (Corner 2)
										const dx_new = cursorX - cp1_x;
										const dy_new = cursorY - cp1_y;
										const len_new = Math.sqrt(dx_new * dx_new + dy_new * dy_new);
										if (len_new !== 0) {
											const px_new = -dy_new / len_new;
											const py_new = dx_new / len_new;
											const p3_new_x = cp1_x + px_new * h_old;
											const p3_new_y = cp1_y + py_new * h_old;

											const pt1 = this._coordsToPoint(cursorX, cursorY);
											const pt2 = this._coordsToPoint(p3_new_x, p3_new_y);
											if (pt1 && pt2) {
												points[1] = pt1;
												points[2] = pt2;
											}
										}
									} else if (this._draggedPointIndex === 2) {
										// Dragging hv3 (Corner 3)
										const h_new = (cursorX - cp2_x) * px + (cursorY - cp2_y) * py;
										const p3_new_x = cp1_x + px * h_new;
										const p3_new_y = cp1_y + py * h_new;

										const pt2 = this._coordsToPoint(p3_new_x, p3_new_y);
										if (pt2) {
											points[2] = pt2;
										}
									} else if (this._draggedPointIndex === 3) {
										// Dragging hv4 (Corner 4)
										const h_new = (cursorX - cp1_x) * px + (cursorY - cp1_y) * py;
										const p3_new_x = cp1_x + px * h_new;
										const p3_new_y = cp1_y + py * h_new;

										const pt2 = this._coordsToPoint(p3_new_x, p3_new_y);
										if (pt2) {
											points[2] = pt2;
										}
									} else if (this._draggedPointIndex === 4 || this._draggedPointIndex === 5) {
										// Midpoint dragging (symmetric height adjustment)
										let h_new = h_old;
										if (this._draggedPointIndex === 4) {
											h_new = 2 * ((cursorX - cp1_x) * px + (cursorY - cp1_y) * py);
										} else {
											h_new = 2 * ((cursorX - cp2_x) * px + (cursorY - cp2_y) * py);
										}
										const p3_new_x = cp1_x + px * h_new;
										const p3_new_y = cp1_y + py * h_new;

										const pt2 = this._coordsToPoint(p3_new_x, p3_new_y);
										if (pt2) {
											points[2] = pt2;
										}
									}
								}
							} else {
								// Fallback
								if (this._draggedPointIndex === 0) {
									points[0] = { time: this._crosshairTime!, price: this._crosshairPrice! };
								} else if (this._draggedPointIndex === 1) {
									points[1] = { time: this._crosshairTime!, price: this._crosshairPrice! };
								} else {
									points[2] = { time: this._crosshairTime!, price: this._crosshairPrice! };
								}
							}
						} else {
							points[this._draggedPointIndex!] = {
								time: this._crosshairTime!,
								price: this._crosshairPrice!
							};
						}
						const newD = { ...d, points };
						if (d.type === 'measure') {
							this._updateMeasureText(newD);
						}
						return newD;
					}
					return d;
				});
				this.setDrawings(updated);
			}
		} else if (this._dragMode === 'body' && this._draggedDrawingId !== null) {
			if (this._crosshairTime !== null && this._rawCrosshairPrice !== null) {
				const cursorLogical = this._timeToLogical(this._crosshairTime);
				const cursorTimeNum = this._timeToNumber(this._crosshairTime);
				const updated = this.drawings.map(d => {
					if (d.id === this._draggedDrawingId) {
						let rawPoints = d.points.map((p, i) => {
							const offset = this._bodyDragOffsets[i];
							if (!offset) return p;

							if (offset.useLogical && offset.dLogical !== undefined && cursorLogical !== null) {
								const newLogical = cursorLogical + offset.dLogical;
								const newTime = this._logicalToTime(newLogical);
								const newPrice = this._rawCrosshairPrice! + offset.dPrice;
								return {
									time: newTime || p.time,
									price: newPrice
								};
							} else {
								const newTimeNum = cursorTimeNum + (offset.dTime || 0);
								const newPrice = this._rawCrosshairPrice! + offset.dPrice;
								return {
									time: this._numberToTime(newTimeNum, p.time),
									price: newPrice
								};
							}
						});

						if (this._magnetMode !== 'off') {
							rawPoints = this._applyMagnetToBody(rawPoints);
						}

						const newD = { ...d, points: rawPoints };
						if (d.type === 'measure') {
							this._updateMeasureText(newD);
						}
						return newD;
					}
					return d;
				});
				this.setDrawings(updated);
			}
		}
	}

	public pressedMouseMoveEvent(event: MouseEventHandlerMouseEvent): boolean {
		if (!this._inTouchFlow) {
			this._isTouchActive = false;
		}
		this._updateCurrentTimeAndPrice(event.localX, event.localY);
		if (this._dragMode !== null) {
			this._handleDragMove();
			return true;
		}
		if (this._activeTool) {
			if (this._activeTool === 'brush' && this._currentDrawing) {
				if (this._crosshairTime && this._crosshairPrice !== null) {
					let shouldAdd = true;
					if (this._lastBrushScreenPoint) {
						const dx = event.localX - this._lastBrushScreenPoint.x;
						const dy = event.localY - this._lastBrushScreenPoint.y;
						if (Math.sqrt(dx * dx + dy * dy) < 5) {
							shouldAdd = false;
						}
					}
					if (shouldAdd) {
						const points = [...this._currentDrawing.points];
						points.push({ time: this._crosshairTime, price: this._crosshairPrice });
						this._currentDrawing.points = points;
						this._primitive.updateAllViews();
						this._lastBrushScreenPoint = { x: event.localX, y: event.localY };
					}
				}
			}
			return true;
		}
		return false;
	}

	public mouseUpEvent(event: MouseEventHandlerMouseEvent): boolean {
		if (!this._inTouchFlow) {
			this._isTouchActive = false;
		}
		this._updateCurrentTimeAndPrice(event.localX, event.localY);
		let consumed = false;
		if (this._dragMode) {
			this._dragMode = null;
			this._draggedDrawingId = null;
			this._draggedPointIndex = null;
			this._bodyDragOffsets = [];
			this._restoreChartNavigation();
			this._updateCursor();
			consumed = true;
		}

		// Finalize brush drawing on mouse up
		if (this._activeTool === 'brush' && this._currentDrawing) {
			this._finalizeDrawing();
			this._lastBrushScreenPoint = null;
			consumed = true;
		}

		return consumed;
	}

	public touchStartEvent(event: MouseEventHandlerTouchEvent): boolean {
		if (event.touches && event.touches.length > 1) {
			// Multi-touch active. Abort any drawing drag state and let pinch-zoom take over.
			this._dragMode = null;
			this._draggedDrawingId = null;
			return false;
		}

		this._isTouchActive = true;
		this._inTouchFlow = true;
		try {
			return this.mouseDownEvent({
				clientX: event.clientX,
				clientY: event.clientY,
				localX: event.localX,
				localY: event.localY,
			} as unknown as MouseEventHandlerMouseEvent);
		} finally {
			this._inTouchFlow = false;
		}
	}

	public touchMoveEvent(event: MouseEventHandlerTouchEvent): boolean {
		if (event.touches && event.touches.length > 1) {
			this._dragMode = null;
			this._draggedDrawingId = null;
			return false;
		}

		this._isTouchActive = true;
		this._inTouchFlow = true;
		try {
			return this.pressedMouseMoveEvent({
				clientX: event.clientX,
				clientY: event.clientY,
				localX: event.localX,
				localY: event.localY,
			} as unknown as MouseEventHandlerMouseEvent);
		} finally {
			this._inTouchFlow = false;
		}
	}

	public touchEndEvent(event: MouseEventHandlerTouchEvent): boolean {
		this._isTouchActive = true;
		this._inTouchFlow = true;
		try {
			return this.mouseUpEvent({
				clientX: event.clientX,
				clientY: event.clientY,
				localX: event.localX,
				localY: event.localY,
			} as unknown as MouseEventHandlerMouseEvent);
		} finally {
			this._inTouchFlow = false;
		}
	}

	private _getMagnetSnapForPoint(p: DrawingPoint): number | null {
		if (this._magnetMode === 'off' || this._seriesData.length === 0) return null;
		
		let candle = this._seriesData.find(d => d.time === p.time);
		if (!candle) {
			const pTimeNum = this._timeToNumber(p.time);
			let minTimeDiff = Infinity;
			for (const d of this._seriesData) {
				const diff = Math.abs(this._timeToNumber(d.time) - pTimeNum);
				if (diff < minTimeDiff) {
					minTimeDiff = diff;
					candle = d;
				}
			}
		}

		if (!candle) return null;

		const prices = [candle.open, candle.high, candle.low, candle.close];
		let closest = prices[0];
		let minDist = Math.abs(p.price - closest);
		for (let i = 1; i < prices.length; i++) {
			const dist = Math.abs(p.price - prices[i]);
			if (dist < minDist) {
				minDist = dist;
				closest = prices[i];
			}
		}

		if (this._magnetMode === 'strong') {
			return closest;
		} else if (this._magnetMode === 'weak') {
			const pY = this._series.priceToCoordinate(p.price);
			const closestY = this._series.priceToCoordinate(closest);
			if (pY !== null && closestY !== null) {
				if (Math.abs(pY - closestY) <= this._weakMagnetThresholdPx) {
					return closest;
				}
			}
		}
		return null;
	}

	private _applyMagnetToBody(rawPoints: DrawingPoint[]): DrawingPoint[] {
		let bestDelta = 0;
		let minAbsDelta = Infinity;

		for (const p of rawPoints) {
			const snappedPrice = this._getMagnetSnapForPoint(p);
			if (snappedPrice !== null) {
				const delta = snappedPrice - p.price;
				if (Math.abs(delta) < minAbsDelta) {
					minAbsDelta = Math.abs(delta);
					bestDelta = delta;
				}
			}
		}

		if (minAbsDelta !== Infinity && minAbsDelta !== 0) {
			return rawPoints.map(p => ({
				time: p.time,
				price: p.price + bestDelta
			}));
		}
		return rawPoints;
	}

	public keyDownEvent(event: KeyboardEvent): boolean {
		let consumed = false;
		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
				this.deleteSelected();
				consumed = true;
			}
		}
		if (event.key === 'Escape') {
			let cancelled = false;
			if (this._currentDrawing) {
				this._primitive.drawings = this._primitive.drawings.filter(d => d.id !== this._currentDrawing!.id);
				this._currentDrawing = null;
				this._lockedPointsCount = 0;
				this._primitive.updateAllViews();
				cancelled = true;
			}
			if (this._activeTool) {
				this._restoreChartNavigation();
				this._activeTool = null;
				this._updateCursor();
				this._notifyToolChange();
				cancelled = true;
			}
			if (cancelled) {
				consumed = true;
			}
		}
		return consumed;
	}

	private _checkHoveredPoint(x: number, y: number) {
		let hovered: { drawingId: string; pointIndex: number } | null = null;

		for (let i = this.drawings.length - 1; i >= 0; i--) {
			const d = this.drawings[i];
			if (!d.selected || d.options.locked) continue;
			const pts = this._primitive.renderedPoints.get(d.id);
			if (!pts) continue;

			for (let j = 0; j < pts.length; j++) {
				const p = pts[j];
				const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
				if (dist < this._getHitRadius(true)) {
					hovered = { drawingId: d.id, pointIndex: j };
					break;
				}
			}
			if (hovered) break;
		}

		if (
			this._primitive.hoveredPointInfo?.drawingId !== hovered?.drawingId ||
			this._primitive.hoveredPointInfo?.pointIndex !== hovered?.pointIndex
		) {
			this._primitive.hoveredPointInfo = hovered;
			this._primitive.requestUpdate();
			if (hovered) {
				this._chartElement.style.cursor = 'nwse-resize';
			} else {
				this._chartElement.style.cursor = '';
			}
		}
	}

	private _checkHoveredBody(x: number, y: number) {
		let hoveredId: string | null = null;
		for (let i = this.drawings.length - 1; i >= 0; i--) {
			const d = this.drawings[i];
			if (d.options.locked) continue;
			const pts = this._primitive.renderedPoints.get(d.id);
			if (!pts || pts.length === 0) continue;
			if (this._isPointHitOnDrawing(x, y, pts, d)) {
				hoveredId = d.id;
				break;
			}
		}

		if (this._hoveredDrawingId !== hoveredId) {
			this._hoveredDrawingId = hoveredId;
			this._primitive.hoveredDrawingId = hoveredId;
			this._primitive.updateAllViews();
		}

		// Only update cursor if no handle is hovered
		if (!this._primitive.hoveredPointInfo) {
			this._chartElement.style.cursor = hoveredId ? 'grab' : '';
		}
	}

	/**
	 * Check if (mouseX, mouseY) hits a drawing's rendered shape.
	 * Checks both point proximity and line segment proximity.
	 */
	private _isPointHitOnDrawing(
		mouseX: number,
		mouseY: number,
		pts: { x: number; y: number }[],
		drawing: Drawing
	): boolean {
		const HIT_RADIUS = this._getHitRadius(false);

		// Check proximity to any anchor point
		for (const p of pts) {
			const dist = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2);
			if (dist < HIT_RADIUS) return true;
		}

		if (pts.length < 2 && drawing.type !== 'cross' && drawing.type !== 'text') return false;

		const p1 = pts[0];
		const p2 = pts[1];

		switch (drawing.type) {
			case 'trendline':
			case 'ray':
				return this._distToSegment(mouseX, mouseY, p1, p2) < HIT_RADIUS;

			case 'horizontal':
				return Math.abs(mouseY - p1.y) < HIT_RADIUS;

			case 'vertical':
				return Math.abs(mouseX - p1.x) < HIT_RADIUS;

			case 'cross':
				return Math.abs(mouseY - p1.y) < HIT_RADIUS || Math.abs(mouseX - p1.x) < HIT_RADIUS;

			case 'rectangle':
			case 'measure': {
				const minX = Math.min(p1.x, p2.x);
				const maxX = Math.max(p1.x, p2.x);
				const minY = Math.min(p1.y, p2.y);
				const maxY = Math.max(p1.y, p2.y);
				const nearLeft = Math.abs(mouseX - minX) < HIT_RADIUS && mouseY >= minY && mouseY <= maxY;
				const nearRight = Math.abs(mouseX - maxX) < HIT_RADIUS && mouseY >= minY && mouseY <= maxY;
				const nearTop = Math.abs(mouseY - minY) < HIT_RADIUS && mouseX >= minX && mouseX <= maxX;
				const nearBottom = Math.abs(mouseY - maxY) < HIT_RADIUS && mouseX >= minX && mouseX <= maxX;
				const inside = mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY;
				return nearLeft || nearRight || nearTop || nearBottom || inside;
			}

			case 'circle':
			case 'ellipse': {
				const rx = Math.abs(p2.x - p1.x);
				const ry = Math.abs(p2.y - p1.y);
				if (rx === 0 || ry === 0) return false;
				const nx = (mouseX - p1.x) / rx;
				const ny = (mouseY - p1.y) / ry;
				const ellipseDist = Math.sqrt(nx * nx + ny * ny);
				return Math.abs(ellipseDist - 1) < 0.3 || ellipseDist < 1;
			}

			case 'parallel_channel': {
				const p3 = pts[2];
				if (!p3) return false;
				const dx = p2.x - p1.x;
				const dy = p2.y - p1.y;
				const len = Math.sqrt(dx * dx + dy * dy);
				if (len === 0) return false;

				const px = -dy / len;
				const py = dx / len;
				const dot = (p3.x - p1.x) * px + (p3.y - p1.y) * py;
				const offset_x = px * dot;
				const offset_y = py * dot;

				const v3 = { x: p2.x + offset_x, y: p2.y + offset_y };
				const v4 = { x: p1.x + offset_x, y: p1.y + offset_y };

				const nearBorder = (
					this._distToSegment(mouseX, mouseY, p1, p2) < HIT_RADIUS ||
					this._distToSegment(mouseX, mouseY, v3, v4) < HIT_RADIUS
				);

				const mx = mouseX - p1.x;
				const my = mouseY - p1.y;
				const bx = p2.x - p1.x;
				const by = p2.y - p1.y;

				const dotBase = (mx * bx + my * by) / (len * len);
				const dotPerp = (mx * offset_x + my * offset_y) / (offset_x * offset_x + offset_y * offset_y);

				const inside = dotBase >= 0 && dotBase <= 1 && dotPerp >= 0 && dotPerp <= 1;

				return nearBorder || inside;
			}

			case 'rotated_rectangle': {
				const p3 = pts[2];
				if (!p3) return false;
				const dx = p2.x - p1.x;
				const dy = p2.y - p1.y;
				const len = Math.sqrt(dx * dx + dy * dy);
				if (len === 0) return false;

				const px = -dy / len;
				const py = dx / len;
				const dot = (p3.x - p1.x) * px + (p3.y - p1.y) * py;
				const offset_x = px * dot;
				const offset_y = py * dot;

				const v3 = { x: p2.x + offset_x, y: p2.y + offset_y };
				const v4 = { x: p1.x + offset_x, y: p1.y + offset_y };

				const nearBorder = (
					this._distToSegment(mouseX, mouseY, p1, p2) < HIT_RADIUS ||
					this._distToSegment(mouseX, mouseY, p2, v3) < HIT_RADIUS ||
					this._distToSegment(mouseX, mouseY, v3, v4) < HIT_RADIUS ||
					this._distToSegment(mouseX, mouseY, v4, p1) < HIT_RADIUS
				);

				const mx = mouseX - p1.x;
				const my = mouseY - p1.y;
				const bx = p2.x - p1.x;
				const by = p2.y - p1.y;

				const dotBase = (mx * bx + my * by) / (len * len);
				const dotPerp = (mx * offset_x + my * offset_y) / (offset_x * offset_x + offset_y * offset_y);

				const inside = dotBase >= 0 && dotBase <= 1 && dotPerp >= 0 && dotPerp <= 1;

				return nearBorder || inside;
			}

			case 'text': {
				const bounds = this._primitive.textBounds.get(drawing.id);
				const fontSize = drawing.options.fontSize || 12;
				const text = drawing.options.text || '';
				const textWidth = bounds ? bounds.width : (text.length * fontSize * 0.6);
				const textHeight = bounds ? bounds.height : fontSize;
				const padX = 8;
				const padY = 6;
				return mouseX >= p1.x - padX && mouseX <= p1.x + textWidth + padX &&
					   mouseY >= p1.y - textHeight - padY && mouseY <= p1.y + padY;
			}

			case 'brush': {
				for (let i = 1; i < pts.length; i++) {
					if (this._distToSegment(mouseX, mouseY, pts[i - 1], pts[i]) < HIT_RADIUS) return true;
				}
				return false;
			}

			case 'long_position':
			case 'short_position': {
				const targetY = p2.y;
				const stopY = pts[2] ? pts[2].y : p1.y + (p1.y - p2.y);
				const xMin = Math.min(p1.x, p2.x, pts[2] ? pts[2].x : p1.x);
				const xMax = Math.max(p1.x, p2.x, pts[2] ? pts[2].x : p2.x);
				const w = Math.max(xMax - xMin, 20);

				const nearEntry = Math.abs(mouseY - p1.y) < HIT_RADIUS && mouseX >= xMin && mouseX <= xMin + w;
				const nearTarget = Math.abs(mouseY - targetY) < HIT_RADIUS && mouseX >= xMin && mouseX <= xMin + w;
				const nearStop = Math.abs(mouseY - stopY) < HIT_RADIUS && mouseX >= xMin && mouseX <= xMin + w;

				const minY = Math.min(p1.y, targetY, stopY);
				const maxY = Math.max(p1.y, targetY, stopY);
				const nearLeft = Math.abs(mouseX - xMin) < HIT_RADIUS && mouseY >= minY && mouseY <= maxY;
				const nearRight = Math.abs(mouseX - (xMin + w)) < HIT_RADIUS && mouseY >= minY && mouseY <= maxY;

				const inside = mouseX >= xMin && mouseX <= xMin + w && mouseY >= minY && mouseY <= maxY;

				return nearEntry || nearTarget || nearStop || nearLeft || nearRight || inside;
			}

			default:
				return this._distToSegment(mouseX, mouseY, p1, p2) < HIT_RADIUS;
		}
	}

	/** Distance from point (px, py) to line segment (a, b) */
	private _distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		if (dx === 0 && dy === 0) {
			return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
		}
		const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
		const closestX = a.x + t * dx;
		const closestY = a.y + t * dy;
		return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
	}

	private _coordsToPoint(x: number, y: number): { time: Time; price: number } | null {
		const timeScale = this._chart.timeScale();
		const logical = timeScale.coordinateToLogical(x);
		if (logical === null) return null;
		const time = this._logicalToTime(logical);
		const price = this._series.coordinateToPrice(y);
		if (!time || price === null) return null;
		return { time, price };
	}

	// Time type helpers for body drag
	private _timeToNumber(time: Time): number {
		if (typeof time === 'number') return time;
		if (typeof time === 'string') return new Date(time).getTime() / 1000;
		// BusinessDay
		const bd = time as { year: number; month: number; day: number };
		return new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
	}

	private _logicalToTime(logical: number): Time | null {
		if (!this._seriesData || this._seriesData.length < 2) return null;
		const lastIndex = this._seriesData.length - 1;

		const floor = Math.floor(logical);
		const ceil = Math.ceil(logical);
		const fraction = logical - floor;

		if (logical >= 0 && logical <= lastIndex) {
			if (floor === ceil) return this._seriesData[floor].time;
			const t1 = this._timeToNumber(this._seriesData[floor].time);
			const t2 = this._timeToNumber(this._seriesData[ceil].time);
			const interpolated = t1 + (t2 - t1) * fraction;
			return this._numberToTime(interpolated, this._seriesData[floor].time);
		}

		const lastTimeNum = this._timeToNumber(this._seriesData[lastIndex].time);
		const prevTimeNum = this._timeToNumber(this._seriesData[lastIndex - 1].time);
		const diffEnd = lastTimeNum - prevTimeNum;

		if (logical > lastIndex) {
			const targetTimeNum = lastTimeNum + (logical - lastIndex) * diffEnd;
			return this._numberToTime(targetTimeNum, this._seriesData[lastIndex].time);
		} else {
			const firstTimeNum = this._timeToNumber(this._seriesData[0].time);
			const secondTimeNum = this._timeToNumber(this._seriesData[1].time);
			const diffStart = secondTimeNum - firstTimeNum;
			const targetTimeNum = firstTimeNum + logical * diffStart;
			return this._numberToTime(targetTimeNum, this._seriesData[0].time);
		}
	}

	private _timeToLogical(time: Time): number | null {
		if (!this._seriesData || this._seriesData.length < 2) return null;

		const lastIndex = this._seriesData.length - 1;
		const firstTimeNum = this._timeToNumber(this._seriesData[0].time);
		const secondTimeNum = this._timeToNumber(this._seriesData[1].time);
		const lastTimeNum = this._timeToNumber(this._seriesData[lastIndex].time);
		const prevTimeNum = this._timeToNumber(this._seriesData[lastIndex - 1].time);

		const targetTimeNum = this._timeToNumber(time);

		if (targetTimeNum > lastTimeNum) {
			const diff = lastTimeNum - prevTimeNum;
			if (diff === 0) return null;
			return lastIndex + (targetTimeNum - lastTimeNum) / diff;
		} else if (targetTimeNum < firstTimeNum) {
			const diff = secondTimeNum - firstTimeNum;
			if (diff === 0) return null;
			return (targetTimeNum - firstTimeNum) / diff;
		} else {
			for (let i = 0; i < this._seriesData.length - 1; i++) {
				const t1 = this._timeToNumber(this._seriesData[i].time);
				const t2 = this._timeToNumber(this._seriesData[i + 1].time);
				const minT = Math.min(t1, t2);
				const maxT = Math.max(t1, t2);
				if (targetTimeNum >= minT && targetTimeNum <= maxT) {
					const diff = t2 - t1;
					if (diff === 0) return i;
					return i + (targetTimeNum - t1) / diff;
				}
			}
			return lastIndex;
		}
	}

	private _numberToTime(num: number, originalTime: Time): Time {
		if (typeof originalTime === 'number') return Math.round(num) as Time;
		if (typeof originalTime === 'string') {
			const d = new Date(num * 1000);
			return d.toISOString().split('T')[0] as Time;
		}
		// BusinessDay
		const d = new Date(num * 1000);
		return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() } as Time;
	}

	private _updateMeasureText(drawing: Drawing) {
		const p1 = drawing.points[0];
		const p2 = drawing.points[1];
		if (!p1 || !p2) return;

		const startPrice = p1.price;
		const endPrice = p2.price;
		const priceDiff = endPrice - startPrice;
		const pctChange = ((priceDiff / startPrice) * 100);

		// Calculate bars and days using series data
		let barsStr = '';
		let durationStr = '';
		if (this._seriesData && this._seriesData.length > 0) {
			const startIndex = this._seriesData.findIndex(d => d.time === p1.time);
			const endIndex = this._seriesData.findIndex(d => d.time === p2.time);
			if (startIndex !== -1 && endIndex !== -1) {
				const bars = Math.abs(endIndex - startIndex);
				barsStr = `${bars} bars`;
				
				// calculate duration based on time diff
				const t1 = this._timeToNumber(p1.time);
				const t2 = this._timeToNumber(p2.time);
				const diffSec = Math.abs(t2 - t1);
				if (diffSec >= 86400) {
					durationStr = `${Math.round(diffSec / 86400)}d`;
				} else if (diffSec >= 3600) {
					durationStr = `${Math.round(diffSec / 3600)}h`;
				} else {
					durationStr = `${Math.round(diffSec / 60)}m`;
				}
			}
		} else {
			const t1 = this._timeToNumber(p1.time);
			const t2 = this._timeToNumber(p2.time);
			const diffSec = Math.abs(t2 - t1);
			durationStr = `${Math.round(diffSec / 86400)}d`;
		}

		const arrow = priceDiff >= 0 ? '▲' : '▼';
		const sign = priceDiff >= 0 ? '+' : '';
		const text = `${arrow} ${Math.abs(priceDiff).toFixed(2)} (${sign}${pctChange.toFixed(2)}%)\n${barsStr}${durationStr ? ' (' + durationStr + ')' : ''}`;
		
		drawing.options.text = text;
		
		// Color dynamically
		const isPositive = priceDiff >= 0;
		drawing.options.lineColor = isPositive ? '#26a69a' : '#ef5350';
		drawing.options.fillColor = isPositive ? 'rgba(38, 166, 154, 0.15)' : 'rgba(239, 83, 80, 0.15)';
	}
}
