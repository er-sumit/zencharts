function generateData() {
	const result = [];
	for (let i = 0; i < 10; ++i) {
		result.push({
			time: i,
			value: 0.0000000000000001,
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
			minMove: 1e-10,
			precision: 10,
		},
	});

	mainSeries.setData(generateData());

	return new Promise(resolve => {
		setTimeout(() => {
			chart.timeScale().setVisibleLogicalRange(chart.timeScale().getVisibleLogicalRange());
			resolve();
		}, 300);
	});
}
