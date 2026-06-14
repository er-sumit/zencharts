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

let mainSeries;

function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	mainSeries = chart.addSeries(ZenCharts.LineSeries);

	mainSeries.setData(generateLineData());

	// Cover edge case
	chart.timeScale().setVisibleRange({
		from: 0,
		to: 0.8,
	});

	testSeriesApi(mainSeries);
	return Promise.resolve();
}

function afterInteractions() {
	mainSeries.applyOptions({ lineType: ZenCharts.LineType.WithSteps });
	return new Promise(resolve => {
		requestAnimationFrame(() => {
			mainSeries.applyOptions({ lineType: ZenCharts.LineType.Curved });
			requestAnimationFrame(resolve);
		});
	});
}
