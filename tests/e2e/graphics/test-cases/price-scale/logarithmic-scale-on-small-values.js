function generateData() {
	const result = [];
	for (let i = 0; i < 100; ++i) {
		result.push({
			time: i,
			value: 0.000000001 * i,
		});
	}

	return result;
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		rightPriceScale: {
			mode: ZenCharts.PriceScaleMode.Logarithmic,
		},
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(ZenCharts.AreaSeries, {
		priceFormat: {
			minMove: 1e-9,
			precision: 9,
		},
	});

	mainSeries.setData(generateData());

	chart.timeScale().fitContent();
}
