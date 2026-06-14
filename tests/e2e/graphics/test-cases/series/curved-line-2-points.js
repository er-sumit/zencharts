function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, { layout: { attributionLogo: false } });

	const lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		lineType: ZenCharts.LineType.Curved,
	});

	const data = [
		{ time: new Date(2000, 0, 1).getTime() / 1000, value: 5 },
		{ time: new Date(2000, 1, 1).getTime() / 1000, value: 15 },
	];

	lineSeries.setData(data);

	chart.timeScale().fitContent();
}
