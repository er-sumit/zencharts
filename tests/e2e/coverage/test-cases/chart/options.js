function interactionsToPerform() {
	return [];
}

function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.AreaSeries);

	mainSeries.setData(generateLineData());

	chart.options();

	chart.applyOptions({
		localization: {
			dateFormat: 'yyyy MM dd',
		},
	});

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	return Promise.resolve();
}
