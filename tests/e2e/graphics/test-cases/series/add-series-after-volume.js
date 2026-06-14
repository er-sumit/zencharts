// fix the first case from
// https://github.com/zen-charts/zen-charts/issues/110

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, { layout: { attributionLogo: false } });

	const areaSeries = chart.addSeries(ZenCharts.AreaSeries); // or any other series type
	const volumeSeries = chart.addSeries(ZenCharts.HistogramSeries);

	volumeSeries.setData([
		{ time: '2019-05-24', value: 23714686.00, color: 'red' },
	]);

	areaSeries.setData([
		{ time: '2019-05-24', value: 179.66 },
	]);
}
