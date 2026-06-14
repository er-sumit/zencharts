function simpleData() {
	return [
		{ time: 1663740000, value: 10 },
		{ time: 1663750000, value: 20 },
		{ time: 1663760000, value: 30 },
	];
}

function interactionsToPerform() {
	return [{ action: 'kineticAnimation', target: 'pane' }];
}

function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container, {
		kineticScroll: {
			mouse: true,
		},
	});

	const mainSeries = chart.addSeries(ZenCharts.LineSeries);

	mainSeries.setData(simpleData());

	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
