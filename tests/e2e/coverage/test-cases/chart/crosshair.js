function interactionsToPerform() {
	return [
		{ action: 'moveMouseCenter', target: 'container' },
		{ action: 'moveMouseTopLeft', target: 'container' },
		{ action: 'moveMouseCenter', target: 'container' },
	];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container, {
		crosshair: {
			mode: ZenCharts.CrosshairMode.Magnet,
			vertLine: {
				labelVisible: false,
				visible: false,
			},
			horzLine: {
				labelVisible: false,
				visible: false,
			},
		},
	});

	const mainSeries = chart.addSeries(ZenCharts.CandlestickSeries);
	mainSeries.setData(generateBars());

	const lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		crosshairMarkerBorderColor: 'orange',
		crosshairMarkerBackgroundColor: 'orange',
		crosshairMarkerRadius: 6,
	});
	lineSeries.setData(generateLineData());

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	chart.applyOptions({
		crosshair: {
			mode: ZenCharts.CrosshairMode.Normal,
			vertLine: {
				labelVisible: true,
				visible: true,
			},
			horzLine: {
				labelVisible: true,
				visible: true,
			},
		},
	});
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}
