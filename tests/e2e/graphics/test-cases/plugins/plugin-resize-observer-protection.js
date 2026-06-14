class PluginBase {
	constructor() {
		this._chart = undefined;
		this._series = undefined;
		this._requestUpdate = undefined;
		this._fireDataUpdated = (scope) => {
			if (this.dataUpdated) {
				this.dataUpdated(scope);
			}
		};
	}

	requestUpdate() {
		if (this._requestUpdate) this._requestUpdate();
	}

	attached({ chart, series, requestUpdate }) {
		this._chart = chart;
		this._series = series;
		this._series.subscribeDataChanged(this._fireDataUpdated);
		this._requestUpdate = requestUpdate;
		this.requestUpdate();
	}

	detached() {
		this._series?.unsubscribeDataChanged(this._fireDataUpdated);
		this._chart = undefined;
		this._series = undefined;
		this._requestUpdate = undefined;
	}

	get chart() {
		return this._chart;
	}

	get series() {
		return this._series;
	}
}

class TrendLinePaneRenderer {
	constructor(p1, p2, text1, text2, options) {
		this._p1 = p1;
		this._p2 = p2;
		this._text1 = text1;
		this._text2 = text2;
		this._options = options;
	}

	draw(target) {
		target.useBitmapCoordinateSpace(scope => {
			if (
				this._p1.x === null ||
				this._p1.y === null ||
				this._p2.x === null ||
				this._p2.y === null
			)
				return;
			const ctx = scope.context;
			const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
			const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
			const x2Scaled = Math.round(this._p2.x * scope.horizontalPixelRatio);
			const y2Scaled = Math.round(this._p2.y * scope.verticalPixelRatio);
			ctx.lineWidth = this._options.width;
			ctx.strokeStyle = this._options.lineColor;
			ctx.beginPath();
			ctx.moveTo(x1Scaled, y1Scaled);
			ctx.lineTo(x2Scaled, y2Scaled);
			ctx.stroke();
			if (this._options.showLabels) {
				this._drawTextLabel(scope, this._text1, x1Scaled, y1Scaled, true);
				this._drawTextLabel(scope, this._text2, x2Scaled, y2Scaled, false);
			}
		});
	}

	_drawTextLabel(scope, text, x, y, left) {
		scope.context.font = '24px Arial';
		scope.context.beginPath();
		const offset = 5 * scope.horizontalPixelRatio;
		const textWidth = scope.context.measureText(text);
		const leftAdjustment = left ? textWidth.width + offset * 4 : 0;
		scope.context.fillStyle = this._options.labelBackgroundColor;
		scope.context.rect(x + offset - leftAdjustment, y - 24, textWidth.width + offset * 2,  24 + offset);
		scope.context.fill();
		scope.context.beginPath();
		scope.context.fillStyle = this._options.labelTextColor;
		scope.context.fillText(text, x + offset * 2 - leftAdjustment, y);
	}
}

class TrendLinePaneView {
	constructor(source) {
		this._source = source;
		this._p1 = { x: null, y: null };
		this._p2 = { x: null, y: null };
	}

	update() {
		const series = this._source._series;
		const y1 = series.priceToCoordinate(this._source._p1.price);
		const y2 = series.priceToCoordinate(this._source._p2.price);
		const timeScale = this._source._chart.timeScale();
		const x1 = timeScale.timeToCoordinate(this._source._p1.time);
		const x2 = timeScale.timeToCoordinate(this._source._p2.time);
		this._p1 = { x: x1, y: y1 };
		this._p2 = { x: x2, y: y2 };
	}

	renderer() {
		return new TrendLinePaneRenderer(
			this._p1,
			this._p2,
			'' + this._source._p1.price.toFixed(1),
			'' + this._source._p2.price.toFixed(1),
			this._source._options
		);
	}
}

const defaultOptions = {
	lineColor: 'rgb(255, 0, 0)',
	width: 6,
	showLabels: true,
	labelBackgroundColor: 'rgba(0, 0, 0, 0.85)',
	labelTextColor: 'rgb(255, 255, 255)',
};

class TrendLine extends PluginBase {
	constructor(
		chart,
		series,
		p1,
		p2,
		options
	) {
		super();
		this._chart = chart;
		this._series = series;
		this._p1 = p1;
		this._p2 = p2;
		this._minPrice = Math.min(this._p1.price, this._p2.price);
		this._maxPrice = Math.max(this._p1.price, this._p2.price);
		this._options = {
			...defaultOptions,
			...options,
		};
		this._paneViews = [new TrendLinePaneView(this)];
	}

	autoscaleInfo(startTimePoint, endTimePoint) {
		const p1Index = this._pointIndex(this._p1);
		const p2Index = this._pointIndex(this._p2);
		if (p1Index === null || p2Index === null) return null;
		if (endTimePoint < p1Index || startTimePoint > p2Index) return null;
		return {
			priceRange: {
				minValue: this._minPrice,
				maxValue: this._maxPrice,
			},
		};
	}

	updateAllViews() {
		this._paneViews.forEach(pw => pw.update());
	}

	paneViews() {
		return this._paneViews;
	}

	_pointIndex(p) {
		const coordinate = this._chart
			.timeScale()
			.timeToCoordinate(p.time);
		if (coordinate === null) return null;
		const index = this._chart.timeScale().coordinateToLogical(coordinate);
		return index;
	}
}

function runTestCase(container) {
	window.ignoreMouseMove = true;
	return new Promise(resolve => {
		try {
			// Set initial deterministic size
			container.style.width = '600px';
			container.style.height = '400px';

			const chart = (window.chart = ZenCharts.createChart(container, {
				layout: { attributionLogo: false },
				timeScale: { timeVisible: true },
				autoSize: true,
			}));

			const mainSeries = chart.addSeries(ZenCharts.LineSeries);
			const data = [];
			for (let i = 0; i < 100; ++i) {
				data.push({
					time: 1600000000 + i * 86400,
					value: i * 2,
				});
			}
			mainSeries.setData(data);

			// Create a deterministic trend line that crosses the chart
			const trend = new TrendLine(
				chart, 
				mainSeries, 
				{ time: 1600000000 + 10 * 86400, price: 20 }, 
				{ time: 1600000000 + 90 * 86400, price: 180 },
				{ width: 4 }
			);
			mainSeries.attachPrimitive(trend);

			// Trigger initial layout
			chart.timeScale().fitContent();

			// Trigger ResizeObserver asynchronously via DOM resize
			requestAnimationFrame(() => {
				try {
					container.style.width = '400px';
					container.style.height = '300px';
					
					// Wait for ResizeObserver to trigger and repaint
					setTimeout(() => {
						try {
							chart.timeScale().fitContent();
							resolve();
						} catch(e) {
							container.innerText = e.stack;
							resolve();
						}
					}, 100);
				} catch(e) {
					container.innerText = e.stack;
					resolve();
				}
			});
		} catch(e) {
			container.innerText = e.stack;
			resolve();
		}
	});
}
