function interactionsToPerform() {
	return [
		{ action: 'longTouch', target: 'pane' },
		{ action: 'swipeTouchDiagonal', target: 'pane' },
		{ action: 'tap', target: 'container' },
		{ action: 'swipeTouchDiagonal', target: 'container' },
		{ action: 'longTouch', target: 'pane' },
	];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container, {
		trackingMode: {
			exitMode: ZenCharts.TrackingModeExitMode.OnNextTap,
		},
	});

	const mainSeries = chart.addSeries(ZenCharts.HistogramSeries);

	mainSeries.setData(generateHistogramData());

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	chart.takeScreenshot();
	return Promise.resolve();
}
