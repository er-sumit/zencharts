function interactionsToPerform() {
	return [];
}

function testSeriesApi(series) {
	series.options();
	series.coordinateToPrice(300);
	series.priceToCoordinate(300);
	series.priceScale();
	series.applyOptions({
		priceFormatter: a => a.toFixed(2),
	});
	series.priceFormatter();
	series.seriesType();
	series.dataByIndex(10);
	series.dataByIndex(-5);
	series.dataByIndex(-5, ZenCharts.MismatchDirection.NearestRight);
	series.dataByIndex(1500, ZenCharts.MismatchDirection.NearestLeft);
	series.dataByIndex(1500, ZenCharts.MismatchDirection.None);
}

function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.BaselineSeries);

	mainSeries.setData(generateLineData());

	testSeriesApi(mainSeries);

	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
