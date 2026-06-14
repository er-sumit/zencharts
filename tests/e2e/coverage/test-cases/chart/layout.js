function simpleData() {
	return [
		{ time: 1663740000, value: 10 },
		{ time: 1663750000, value: 20 },
		{ time: 1663760000, value: 30 },
	];
}

function interactionsToPerform() {
	return [];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container, {
		layout: {
			background: {
				type: ZenCharts.ColorType.VerticalGradient,
				topColor: '#FFFFFF',
				bottomColor: '#AAFFAA',
			},
		},
	});

	const mainSeries = chart.addSeries(ZenCharts.LineSeries);

	mainSeries.setData(simpleData());

	return Promise.resolve();
}

function afterInteractions() {
	chart.applyOptions({
		layout: {
			background: {
				type: ZenCharts.ColorType.Solid,
				color: 'transparent',
			},
			fontFamily: undefined,
		},
	});
	return Promise.resolve();
}
