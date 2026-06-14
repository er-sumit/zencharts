// fix the second case from
// https://github.com/zen-charts/zen-charts/issues/110

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, { layout: { attributionLogo: false } });

	const areaSeries = chart.addSeries(ZenCharts.AreaSeries);
	const volumeSeries = chart.addSeries(ZenCharts.HistogramSeries);

	volumeSeries.update(
		{ time: '2019-05-24', value: 23714686.00 }
	);

	areaSeries.setData([
		{ time: '2019-05-24', value: 179.66 },
	]);
}
