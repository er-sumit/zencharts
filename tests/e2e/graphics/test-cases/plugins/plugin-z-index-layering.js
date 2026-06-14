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
}

class BlockPaneRenderer {
	constructor(p1, p2, options) {
		this._p1 = p1;
		this._p2 = p2;
		this._options = options;
	}
	draw(target) {
		target.useBitmapCoordinateSpace(scope => {
			if (this._p1.x === null || this._p1.y === null || this._p2.x === null || this._p2.y === null) return;
			const ctx = scope.context;
			const x1Scaled = Math.round(this._p1.x * scope.horizontalPixelRatio);
			const y1Scaled = Math.round(this._p1.y * scope.verticalPixelRatio);
			const x2Scaled = Math.round(this._p2.x * scope.horizontalPixelRatio);
			const y2Scaled = Math.round(this._p2.y * scope.verticalPixelRatio);
			
			const left = Math.min(x1Scaled, x2Scaled);
			const top = Math.min(y1Scaled, y2Scaled);
			const width = Math.abs(x2Scaled - x1Scaled);
			const height = Math.abs(y2Scaled - y1Scaled);
			
			ctx.fillStyle = this._options.color;
			ctx.fillRect(left, top, width, height);
		});
	}
}

class BlockPaneView {
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
		return new BlockPaneRenderer(this._p1, this._p2, this._source._options);
	}
    zOrder() {
        return this._source._options.zOrder || 'normal';
    }
}

class Block extends PluginBase {
	constructor(chart, series, p1, p2, options) {
		super();
		this._chart = chart;
		this._series = series;
		this._p1 = p1;
		this._p2 = p2;
		this._options = options;
		this._paneViews = [new BlockPaneView(this)];
	}
	updateAllViews() {
		this._paneViews.forEach(pw => pw.update());
	}
	paneViews() {
		return this._paneViews;
	}
}

function runTestCase(container) {
	window.ignoreMouseMove = true;

	const chart = (window.chart = ZenCharts.createChart(container, {
		layout: { attributionLogo: false },
		timeScale: { timeVisible: true }
	}));

	const mainSeries = chart.addSeries(ZenCharts.LineSeries, {
        color: 'black',
        lineWidth: 4,
    });
	const data = [];
	for (let i = 0; i < 100; ++i) {
		data.push({
			time: 1600000000 + i * 86400,
			value: 50, // horizontal line
		});
	}
	mainSeries.setData(data);

	// Block 1: Bottom (should be behind the series line)
	const blockBottom = new Block(
		chart, mainSeries, 
		{ time: 1600000000 + 10 * 86400, price: 70 }, 
		{ time: 1600000000 + 40 * 86400, price: 30 },
		{ color: 'blue', zOrder: 'bottom' }
	);
	mainSeries.attachPrimitive(blockBottom);

	// Block 2: Normal 
	const blockNormal = new Block(
		chart, mainSeries, 
		{ time: 1600000000 + 30 * 86400, price: 70 }, 
		{ time: 1600000000 + 60 * 86400, price: 30 },
		{ color: 'red', zOrder: 'normal' }
	);
	mainSeries.attachPrimitive(blockNormal);

	// Block 3: Top (should be ON TOP of the series line)
	const blockTop = new Block(
		chart, mainSeries, 
		{ time: 1600000000 + 50 * 86400, price: 70 }, 
		{ time: 1600000000 + 80 * 86400, price: 30 },
		{ color: 'green', zOrder: 'top' }
	);
	mainSeries.attachPrimitive(blockTop);

	mainSeries.update({ time: 1600000000 + 100 * 86400, value: 50 });
	chart.timeScale().fitContent();
}
