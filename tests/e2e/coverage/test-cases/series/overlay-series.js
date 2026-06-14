function interactionsToPerform() {
	return [];
}

let chart;
let overlaySeries;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.LineSeries);

	mainSeries.setData(generateLineData());

	overlaySeries = chart.addSeries(ZenCharts.AreaSeries, {
		priceScaleId: 'overlay-id',
		priceFormat: {
			type: 'volume',
		},
		lastPriceAnimation: ZenCharts.LastPriceAnimationMode.Continuous,
	});
	overlaySeries.setData(generateLineData());

	chart.priceScale('overlay-id').width();

	return Promise.resolve();
}

function afterInteractions() {
	chart.removeSeries(overlaySeries);
	return Promise.resolve();
}
