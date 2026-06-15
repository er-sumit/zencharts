import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../model/ipane-primitive';
import { ISeriesPrimitive, SeriesAttachedParameter } from '../../api/iseries-primitive-api';
import { IChartApi } from '../../api/create-chart';
import { ISeriesApi } from '../../api/iseries-api';
import { SeriesType } from '../../model/series-options';
import { Time } from '../../model/horz-scale-behavior-time/types';
import { Logical } from '../../model/time-data';
import { AutoscaleInfo } from '../../model/series-options';

export interface DrawingPoint {
	time: Time;
	price: number;
}

export interface DrawingOptions {
	lineColor?: string;
	fillColor?: string;
	width?: number;
	showLabels?: boolean;
	text?: string;
	extendLeft?: boolean;
	extendRight?: boolean;
	fontSize?: number;
	fontFamily?: string;
	style?: 'solid' | 'dashed' | 'dotted';
	locked?: boolean;
}

export interface Drawing {
	id: string;
	type: string;
	points: DrawingPoint[];
	options: DrawingOptions;
	selected?: boolean;
}

class DrawingPaneRenderer implements IPrimitivePaneRenderer {
	private _drawings: Drawing[];
	private _renderedPoints: Map<string, { x: number; y: number }[]>;
	private _hoveredPointInfo: { drawingId: string; pointIndex: number } | null;
	private _hoveredDrawingId: string | null;
	private _textBounds: Map<string, { width: number; height: number }>;
	private _isHidden: boolean;
	private _isLocked: boolean;

	constructor(
		drawings: Drawing[],
		renderedPoints: Map<string, { x: number; y: number }[]>,
		hoveredPointInfo: { drawingId: string; pointIndex: number } | null,
		hoveredDrawingId: string | null,
		textBounds: Map<string, { width: number; height: number }>,
		isHidden: boolean,
		isLocked: boolean
	) {
		this._drawings = drawings;
		this._renderedPoints = renderedPoints;
		this._hoveredPointInfo = hoveredPointInfo;
		this._hoveredDrawingId = hoveredDrawingId;
		this._textBounds = textBounds;
		this._isHidden = isHidden;
		this._isLocked = isLocked;
	}

	draw(target: CanvasRenderingTarget2D) {
		if (this._isHidden) return;
		target.useBitmapCoordinateSpace((scope: any) => {
			const ctx = scope.context;
			const width = scope.bitmapSize.width;
			const height = scope.bitmapSize.height;
			const horzRatio = scope.horizontalPixelRatio;
			const vertRatio = scope.verticalPixelRatio;

			this._drawings.forEach(drawing => {
				const points = this._renderedPoints.get(drawing.id);
				if (!points || points.length === 0) return;

				const isBodyHovered = this._hoveredDrawingId === drawing.id;
				const getHoverColor = (color: string) => {
					if (color.startsWith('#')) {
						if (color.length === 7) return color + '1a'; // 10% opacity
						if (color.length === 9) return color.substring(0, 7) + '1a';
					}
					return 'rgba(41, 98, 255, 0.1)';
				};

				const opt = {
					lineColor: drawing.options.lineColor || '#2962FF',
					fillColor: drawing.options.fillColor || 'rgba(41, 98, 255, 0.2)',
					width: (drawing.options.width || 2) * horzRatio,
					showLabels: drawing.options.showLabels !== false,
					text: drawing.options.text || 'Text',
					fontSize: (drawing.options.fontSize || 12) * vertRatio,
					fontFamily: drawing.options.fontFamily || 'Arial',
					style: drawing.options.style || 'solid',
				};

				ctx.save();
				ctx.lineWidth = opt.width;
				ctx.strokeStyle = opt.lineColor;
				ctx.fillStyle = opt.fillColor;

				if (opt.style === 'dashed') {
					ctx.setLineDash([6 * horzRatio, 6 * horzRatio]);
				} else if (opt.style === 'dotted') {
					ctx.setLineDash([2 * horzRatio, 4 * horzRatio]);
				} else {
					ctx.setLineDash([]);
				}

				const scaledPoints = points.map(p => ({
					x: Math.round(p.x * horzRatio),
					y: Math.round(p.y * vertRatio),
				}));

				// Subtle body hover glow/outline
				if (isBodyHovered && !this._isLocked) {
					ctx.save();
					ctx.lineWidth = opt.width + 6 * horzRatio;
					ctx.strokeStyle = getHoverColor(opt.lineColor);
					this._renderDrawing(ctx, drawing, scaledPoints, opt, width, height, horzRatio, vertRatio);
					ctx.restore();
				}

				this._renderDrawing(ctx, drawing, scaledPoints, opt, width, height, horzRatio, vertRatio);

				// Draw selection handles if selected and NOT locked
				if (drawing.selected && !this._isLocked) {
					scaledPoints.forEach((p, idx) => {
						const isHovered = this._hoveredPointInfo &&
							this._hoveredPointInfo.drawingId === drawing.id &&
							this._hoveredPointInfo.pointIndex === idx;

						ctx.save();
						ctx.setLineDash([]);
						ctx.fillStyle = isHovered ? '#FF9800' : '#ffffff';
						ctx.strokeStyle = opt.lineColor;
						ctx.lineWidth = 2 * horzRatio;
						ctx.beginPath();
						ctx.arc(p.x, p.y, (isHovered ? 7 : 5) * horzRatio, 0, 2 * Math.PI);
						ctx.fill();
						ctx.stroke();
						ctx.restore();
					});
				}

				ctx.restore();
			});
		});
	}

	private _renderDrawing(
		ctx: CanvasRenderingContext2D,
		drawing: Drawing,
		points: { x: number; y: number }[],
		opt: any,
		width: number,
		height: number,
		horzRatio: number,
		vertRatio: number
	) {
		const p1 = points[0];
		const p2 = points[1];
		const p3 = points[2];
		const type = drawing.type;

		switch (type) {
			case 'vertical': {
				ctx.beginPath();
				ctx.moveTo(p1.x, 0);
				ctx.lineTo(p1.x, height);
				ctx.stroke();
				break;
			}
			case 'cross': {
				ctx.beginPath();
				ctx.moveTo(0, p1.y);
				ctx.lineTo(width, p1.y);
				ctx.stroke();

				ctx.beginPath();
				ctx.moveTo(p1.x, 0);
				ctx.lineTo(p1.x, height);
				ctx.stroke();
				break;
			}
			case 'trendline':
			case 'ray':
			case 'horizontal': {
				if (!p2 && type !== 'horizontal') return;

				let startX = p1.x;
				let startY = p1.y;
				let endX = type === 'horizontal' ? (p2 ? p2.x : width) : p2.x;
				let endY = type === 'horizontal' ? p1.y : p2.y;

				if (type === 'horizontal') {
					startX = opt.extendLeft ? 0 : p1.x;
					endX = opt.extendRight ? width : (p2 ? p2.x : Math.max(width, p1.x + 100));
				} else {
					const dx = endX - startX;
					const dy = endY - startY;
					const len = Math.sqrt(dx * dx + dy * dy);
					if (len !== 0) {
						const maxDist = Math.max(width, height) * 3;
						if (opt.extendRight || type === 'ray') {
							endX = startX + (dx / len) * maxDist;
							endY = startY + (dy / len) * maxDist;
						}
						if (opt.extendLeft) {
							startX = startX - (dx / len) * maxDist;
							startY = startY - (dy / len) * maxDist;
						}
					}
				}

				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				if (opt.showLabels && opt.text) {
					ctx.save();
					ctx.font = `${opt.fontSize || 12}px ${opt.fontFamily || 'Arial'}`;
					ctx.fillStyle = opt.lineColor || '#000';
					ctx.textBaseline = 'bottom';
					ctx.textAlign = 'center';
					
					const textMidX = (p1.x + (p2 ? p2.x : width)) / 2;
					const textMidY = (p1.y + (p2 ? p2.y : p1.y)) / 2;
					
					let angle = 0;
					if (type !== 'horizontal' && p2) {
						angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
						if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
							angle += Math.PI;
						}
					}
					
					ctx.translate(textMidX, textMidY);
					ctx.rotate(angle);
					ctx.fillText(opt.text, 0, -4 * vertRatio);
					ctx.restore();
				}
				break;
			}

			case 'rectangle': {
				if (!p2) return;
				const rx = p1.x;
				const ry = p1.y;
				const rw = p2.x - p1.x;
				const rh = p2.y - p1.y;
				ctx.beginPath();
				ctx.rect(rx, ry, rw, rh);
				ctx.fill();
				ctx.stroke();
				break;
			}
			case 'rotated_rectangle': {
				if (!p2 || !p3) return;
				const dx = p2.x - p1.x;
				const dy = p2.y - p1.y;
				const len = Math.sqrt(dx * dx + dy * dy);
				if (len === 0) return;

				const px = -dy / len;
				const py = dx / len;
				const dot = (p3.x - p1.x) * px + (p3.y - p1.y) * py;
				const offset_x = px * dot;
				const offset_y = py * dot;

				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.lineTo(p2.x + offset_x, p2.y + offset_y);
				ctx.lineTo(p1.x + offset_x, p1.y + offset_y);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				break;
			}
			case 'circle':
			case 'ellipse': {
				if (!p2) return;
				const rx = Math.abs(p2.x - p1.x);
				const ry = Math.abs(p2.y - p1.y);
				ctx.beginPath();
				ctx.ellipse(p1.x, p1.y, rx, ry, 0, 0, 2 * Math.PI);
				ctx.fill();
				ctx.stroke();
				break;
			}

			case 'text': {
				ctx.font = `${opt.fontSize}px ${opt.fontFamily}`;
				const textMetrics = ctx.measureText(opt.text);
				const textWidth = textMetrics.width;
				const textHeight = opt.fontSize;

				// Save bounds (in CSS pixels)
				this._textBounds.set(drawing.id, {
					width: textWidth / horzRatio,
					height: textHeight / vertRatio
				});

				if (drawing.options.fillColor) {
					ctx.save();
					ctx.fillStyle = drawing.options.fillColor;
					ctx.strokeStyle = opt.lineColor;
					ctx.lineWidth = 1 * horzRatio;
					const padX = 6 * horzRatio;
					const padY = 4 * vertRatio;
					ctx.fillRect(p1.x - padX, p1.y - textHeight - padY, textWidth + padX * 2, textHeight + padY * 2);
					ctx.strokeRect(p1.x - padX, p1.y - textHeight - padY, textWidth + padX * 2, textHeight + padY * 2);
					ctx.restore();
				}

				ctx.fillStyle = opt.lineColor;
				ctx.fillText(opt.text, p1.x, p1.y);
				break;
			}
			case 'brush': {
				if (points.length < 2) return;
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				for (let i = 1; i < points.length; i++) {
					ctx.lineTo(points[i].x, points[i].y);
				}
				ctx.setLineDash([]); // Freehand line should be solid
				ctx.stroke();
				break;
			}
			case 'parallel_channel': {
				if (!p2 || !p3) return;
				// p1, p2 represents line 1
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.stroke();

				// Calculate offset for line 2
				const dx = p2.x - p1.x;
				const dy = p2.y - p1.y;
				const len = Math.sqrt(dx * dx + dy * dy);
				if (len === 0) return;

				// Projection of p3 onto perpendicular of line 1
				// Perpendicular vector (-dy, dx)
				const px = -dy / len;
				const py = dx / len;
				// Dot product of p1->p3 with perpendicular vector
				const dot = (p3.x - p1.x) * px + (p3.y - p1.y) * py;
				const offset_x = px * dot;
				const offset_y = py * dot;

				// Draw parallel line
				ctx.beginPath();
				ctx.moveTo(p1.x + offset_x, p1.y + offset_y);
				ctx.lineTo(p2.x + offset_x, p2.y + offset_y);
				ctx.stroke();

				// Draw middle line (dashed)
				ctx.save();
				ctx.setLineDash([4 * horzRatio, 4 * horzRatio]);
				ctx.beginPath();
				ctx.moveTo(p1.x + offset_x * 0.5, p1.y + offset_y * 0.5);
				ctx.lineTo(p2.x + offset_x * 0.5, p2.y + offset_y * 0.5);
				ctx.stroke();
				ctx.restore();

				// Fill channel background
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.lineTo(p2.x + offset_x, p2.y + offset_y);
				ctx.lineTo(p1.x + offset_x, p1.y + offset_y);
				ctx.closePath();
				ctx.fill();
				break;
			}

			case 'long_position':
			case 'short_position': {
				if (!p2) return;
				const isLong = type === 'long_position';
				
				// Entry price is p1.y. Target is based on p2.y. 
				// We compute stop loss symmetrically from entry if p3 isn't available, 
				// but let's allow dragging p3 later. For now, symmetric stop.
				const targetY = p2.y;
				const stopY = p3 ? p3.y : p1.y + (p1.y - p2.y);

				const xMin = Math.min(p1.x, p2.x, p3 ? p3.x : p1.x);
				const xMax = Math.max(p1.x, p2.x, p3 ? p3.x : p2.x);
				const w = Math.max(xMax - xMin, 20); // enforce min width

				// Profit Box
				ctx.save();
				ctx.fillStyle = isLong ? 'rgba(76, 175, 80, 0.25)' : 'rgba(239, 83, 80, 0.25)';
				ctx.fillRect(xMin, Math.min(p1.y, targetY), w, Math.abs(p1.y - targetY));
				ctx.restore();

				// Stop Loss Box
				ctx.save();
				ctx.fillStyle = isLong ? 'rgba(239, 83, 80, 0.25)' : 'rgba(76, 175, 80, 0.25)';
				ctx.fillRect(xMin, Math.min(p1.y, stopY), w, Math.abs(p1.y - stopY));
				ctx.restore();

				// Entry Line
				ctx.beginPath();
				ctx.moveTo(xMin, p1.y);
				ctx.lineTo(xMin + w, p1.y);
				ctx.stroke();

				// Target Line
				ctx.save();
				ctx.strokeStyle = isLong ? '#4CAF50' : '#F44336';
				ctx.beginPath();
				ctx.moveTo(xMin, targetY);
				ctx.lineTo(xMin + w, targetY);
				ctx.stroke();
				ctx.restore();

				// Stop Line
				ctx.save();
				ctx.strokeStyle = isLong ? '#F44336' : '#4CAF50';
				ctx.beginPath();
				ctx.moveTo(xMin, stopY);
				ctx.lineTo(xMin + w, stopY);
				ctx.stroke();
				ctx.restore();

				// Risk Reward text
				const targetAmt = Math.abs(p1.y - targetY);
				const stopAmt = Math.abs(p1.y - stopY);
				const rr = stopAmt !== 0 ? (targetAmt / stopAmt).toFixed(2) : 'N/A';
				ctx.font = `bold ${11 * vertRatio}px Arial`;
				ctx.fillStyle = '#ffffff';
				ctx.fillText(`R/R: ${rr}`, xMin + 5 * horzRatio, p1.y - 5 * vertRatio);
				break;
			}

			case 'measure': {
				if (!p2) return;
				const rx = p1.x;
				const ry = p1.y;
				const rw = p2.x - p1.x;
				const rh = p2.y - p1.y;

				// 1. Draw shaded rectangle
				ctx.save();
				ctx.fillRect(rx, ry, rw, rh);
				ctx.strokeRect(rx, ry, rw, rh);
				ctx.restore();

				// 2. Draw diagonal line
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.stroke();
				ctx.restore();

				// 3. Draw center info box
				if (opt.text) {
					const lines = opt.text.split('\n');
					const cx = (p1.x + p2.x) / 2;
					const cy = (p1.y + p2.y) / 2;

					ctx.save();
					ctx.font = `11px ${opt.fontFamily}`;
					
					// Measure text size to size the tooltip box
					let maxW = 0;
					lines.forEach((line: string) => {
						const m = ctx.measureText(line);
						if (m.width > maxW) maxW = m.width;
					});
					const paddingX = 8 * horzRatio;
					const paddingY = 6 * vertRatio;
					const lineHeight = 14 * vertRatio;
					const boxW = maxW + paddingX * 2;
					const boxH = lines.length * lineHeight + paddingY * 2;
					const bx = cx - boxW / 2;
					const by = cy - boxH / 2;

					// Draw tooltip box background
					ctx.fillStyle = 'rgba(28, 32, 48, 0.95)';
					ctx.strokeStyle = opt.lineColor;
					ctx.lineWidth = 1 * horzRatio;
					
					// Draw rounded rect
					const radius = 4 * horzRatio;
					ctx.beginPath();
					ctx.moveTo(bx + radius, by);
					ctx.lineTo(bx + boxW - radius, by);
					ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + radius);
					ctx.lineTo(bx + boxW, by + boxH - radius);
					ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - radius, by + boxH);
					ctx.lineTo(bx + radius, by + boxH);
					ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - radius);
					ctx.lineTo(bx, by + radius);
					ctx.quadraticCurveTo(bx, by, bx + radius, by);
					ctx.closePath();
					ctx.fill();
					ctx.stroke();

					// Draw text lines
					ctx.textBaseline = 'top';
					lines.forEach((line: string, idx: number) => {
						const textW = ctx.measureText(line).width;
						const tx = cx - textW / 2;
						const ty = by + paddingY + idx * lineHeight;
						
						// Highlight first line color
						if (idx === 0) {
							ctx.fillStyle = opt.lineColor;
						} else {
							ctx.fillStyle = '#b2b5be';
						}
						ctx.fillText(line, tx, ty);
					});
					ctx.restore();
				}
				break;
			}
		}
	}
}

class DrawingPaneView implements IPrimitivePaneView {
	private _source: DrawingPrimitive;

	constructor(source: DrawingPrimitive) {
		this._source = source;
	}

	update() {
		this._source.updateCoordinates();
	}

	renderer() {
		return new DrawingPaneRenderer(
			this._source.drawings,
			this._source.renderedPoints,
			this._source.hoveredPointInfo,
			this._source.hoveredDrawingId,
			this._source.textBounds,
			this._source.isHidden,
			this._source.isLocked
		);
	}
}

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined;
	private _series: ISeriesApi<SeriesType> | undefined;
	private _requestUpdate: (() => void) | undefined;
	private _paneViews: DrawingPaneView[];

	public drawings: Drawing[] = [];
	public renderedPoints: Map<string, { x: number; y: number }[]> = new Map();
	public hoveredPointInfo: { drawingId: string; pointIndex: number } | null = null;
	public hoveredDrawingId: string | null = null;
	public textBounds: Map<string, { width: number; height: number }> = new Map();
	public isHidden = false;
	public isLocked = false;
	public seriesData: any[] = [];

	constructor() {
		this._paneViews = [new DrawingPaneView(this)];
	}

	attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
		this._chart = chart as IChartApi;
		this._series = series;
		this._requestUpdate = requestUpdate;
		this.updateCoordinates();
	}

	detached() {
		this._chart = undefined;
		this._series = undefined;
		this._requestUpdate = undefined;
	}

	updateCoordinates() {
		if (!this._chart || !this._series) return;
		const timeScale = this._chart.timeScale();

		this.drawings.forEach(drawing => {
			const coords = drawing.points.map(p => {
				let x = this.timeToX(p.time, timeScale);
				const y = this._series!.priceToCoordinate(p.price);
				// For drawings where time might be off-screen, we still need a valid x
				// Use a large clamped value so horizontal/vertical lines still render
				// but mark them as approximate using a wide canvas size estimate
				return { x: x ?? -10000, y: y ?? -10000, valid: x !== null && y !== null };
			});

			// For horizontal, vertical, and cross lines - we only need one valid y or x
			// so special-case these so they always appear
			const type = drawing.type;
			let finalCoords: { x: number; y: number }[];

			if (type === 'horizontal') {
				// Only need y coordinate to be valid
				const validY = coords.find(c => c.valid || (c.y !== -10000));
				if (validY) {
					finalCoords = [{ x: 0, y: validY.y }];
				} else {
					finalCoords = [];
				}
			} else if (type === 'vertical') {
				// Only need x coordinate to be valid
				const validX = coords.find(c => c.valid || (c.x !== -10000));
				if (validX) {
					finalCoords = [{ x: validX.x, y: 0 }];
				} else {
					finalCoords = [];
				}
			} else if (type === 'cross') {
				// Need both x and y
				const pt = coords[0];
				if (pt && pt.x !== -10000 && pt.y !== -10000) {
					finalCoords = [{ x: pt.x, y: pt.y }];
				} else {
					finalCoords = [];
				}
			} else if (type === 'rotated_rectangle' || type === 'parallel_channel') {
				if (coords.length >= 3) {
					const hp1 = coords[0];
					const hp2 = coords[1];
					const hp3 = coords[2];

					const dx = hp2.x - hp1.x;
					const dy = hp2.y - hp1.y;
					const len = Math.sqrt(dx * dx + dy * dy);
					if (len !== 0) {
						const px = -dy / len;
						const py = dx / len;
						const dot = (hp3.x - hp1.x) * px + (hp3.y - hp1.y) * py;
						const offset_x = px * dot;
						const offset_y = py * dot;

						const hv3 = { x: hp2.x + offset_x, y: hp2.y + offset_y };
						const hv4 = { x: hp1.x + offset_x, y: hp1.y + offset_y };

						// Always place midpoints on the height sides (perpendicular to baseline)
						const midL = { x: (hp1.x + hv4.x) / 2, y: (hp1.y + hv4.y) / 2 };
						const midR = { x: (hp2.x + hv3.x) / 2, y: (hp2.y + hv3.y) / 2 };

						finalCoords = [
							hp1,    // Index 0 (Corner 1)
							hp2,    // Index 1 (Corner 2)
							hv3,    // Index 2 (Corner 3)
							hv4,    // Index 3 (Corner 4)
							midL,   // Index 4 (Midpoint 1)
							midR    // Index 5 (Midpoint 2)
						];
					} else {
						finalCoords = coords.filter(c => c.valid) as { x: number; y: number }[];
					}
				} else {
					finalCoords = coords.filter(c => c.valid) as { x: number; y: number }[];
				}
			} else if (type === 'trendline') {
				if (coords.length >= 2 && coords[0].valid && coords[1].valid) {
					finalCoords = [
						{ x: coords[0].x, y: coords[0].y },
						{ x: coords[1].x, y: coords[1].y },
						{ x: (coords[0].x + coords[1].x) / 2, y: (coords[0].y + coords[1].y) / 2 }
					];
				} else {
					finalCoords = coords.filter(c => c.valid) as { x: number; y: number }[];
				}
			} else {
				// For all other drawings, filter out completely invalid points
				finalCoords = coords.filter(c => c.valid) as { x: number; y: number }[];
			}

			this.renderedPoints.set(drawing.id, finalCoords);
		});
	}

	requestUpdate() {
		if (this._requestUpdate) {
			this._requestUpdate();
		}
	}

	updateAllViews() {
		this.updateCoordinates();
		this._paneViews.forEach(pw => pw.update());
		this.requestUpdate();
	}

	paneViews() {
		return this._paneViews;
	}

	autoscaleInfo(_startTimePoint: Logical, _endTimePoint: Logical): AutoscaleInfo | null {
		return null;
	}

	private _timeToNumber(time: Time): number {
		if (typeof time === 'number') return time;
		if (typeof time === 'string') return new Date(time).getTime() / 1000;
		const bd = time as { year: number; month: number; day: number };
		return new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
	}

	public timeToX(time: Time, timeScale: any): number | null {
		let x = timeScale.timeToCoordinate(time);
		if (x !== null) return x;

		if (!this.seriesData || this.seriesData.length < 2) return null;

		const lastIndex = this.seriesData.length - 1;
		const firstTimeNum = this._timeToNumber(this.seriesData[0].time);
		const secondTimeNum = this._timeToNumber(this.seriesData[1].time);
		const lastTimeNum = this._timeToNumber(this.seriesData[lastIndex].time);
		const prevTimeNum = this._timeToNumber(this.seriesData[lastIndex - 1].time);

		const targetTimeNum = this._timeToNumber(time);
		let logicalIndex = 0;

		if (targetTimeNum > lastTimeNum) {
			const diff = lastTimeNum - prevTimeNum;
			if (diff === 0) return null;
			logicalIndex = lastIndex + (targetTimeNum - lastTimeNum) / diff;
		} else if (targetTimeNum < firstTimeNum) {
			const diff = secondTimeNum - firstTimeNum;
			if (diff === 0) return null;
			logicalIndex = (targetTimeNum - firstTimeNum) / diff;
		} else {
			let left = 0;
			let right = lastIndex;

			while (left <= right) {
				const mid = Math.floor((left + right) / 2);
				const midTime = this._timeToNumber(this.seriesData[mid].time);
				if (midTime === targetTimeNum) {
					logicalIndex = mid;
					break;
				} else if (midTime < targetTimeNum) {
					left = mid + 1;
				} else {
					right = mid - 1;
				}
			}

			if (left > right) {
				const t1 = this._timeToNumber(this.seriesData[right].time);
				const t2 = this._timeToNumber(this.seriesData[left].time);
				const diff = t2 - t1;
				if (diff === 0) {
					logicalIndex = right;
				} else {
					logicalIndex = right + (targetTimeNum - t1) / diff;
				}
			}
		}

		return timeScale.logicalToCoordinate(logicalIndex as any);
	}
}
