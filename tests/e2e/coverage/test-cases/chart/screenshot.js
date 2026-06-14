function interactionsToPerform() {
	return [];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.HistogramSeries);

	mainSeries.setData(generateHistogramData());

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	chart.takeScreenshot();
	chart.takeScreenshot(true);
	chart.takeScreenshot(true, true);
	return Promise.resolve();
}
