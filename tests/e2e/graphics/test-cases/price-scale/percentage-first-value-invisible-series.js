function runTestCase(container) {
	const chartOptions = {
		rightPriceScale: {
			borderVisible: false,
			mode: 2,
		},
		layout: {
			textColor: 'black',
			background: { type: 'solid', color: 'white' },
			attributionLogo: false,
		},
	};
	const chart = (window.chart = ZenCharts.createChart(
		container,
		chartOptions
	));

	/*
	 * We expect the blue series to NOT be visible
	 * and the red series to BE visible
	 */

	const series1 = chart.addSeries(ZenCharts.LineSeries, {
		color: '#2962FF',
	});
	series1.setData([
		{ time: 1522033200, value: 0 },
		{ time: 1529895600, value: -3 },
		{ time: 1537758000, value: 3 },
	]);
	const series2 = chart.addSeries(ZenCharts.LineSeries, {
		color: '#FF2962',
	});
	series2.setData([
		{ time: 1522033200, value: 1 },
		{ time: 1529895600, value: -1 },
		{ time: 1537758000, value: 2 },
	]);
	chart.timeScale().fitContent();
}
