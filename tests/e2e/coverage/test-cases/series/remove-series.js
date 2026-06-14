function interactionsToPerform() {
	return [];
}

let series;
let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);

	series = chart.addSeries(ZenCharts.AreaSeries);

	series.setData(generateLineData());

	return Promise.resolve();
}

function afterInteractions() {
	chart.removeSeries(series);
	return Promise.resolve();
}
