function runTestCase(container) {
	const chartOptions = {
		height: 500,
		width: 600,
		rightPriceScale: {
			scaleMargins: {
				top: 0,
				bottom: 0,
			},
			entireTextOnly: true,
			alignLabels: true,
		},
		layout: { attributionLogo: false },
	};

	const chart = (window.chart = ZenCharts.createChart(
		container,
		chartOptions
	));

	const data1 = Array.from({ length: 10 }).map((_, index) => ({ time: index * 10000, value: 100 - index }));
	const data2 = Array.from({ length: 10 }).map((_, index) => ({ time: index * 10000, value: 108.3 - index * 2 }));
	const data3 = Array.from({ length: 10 }).map((_, index) => ({ time: index * 10000, value: 99 + index }));
	const data4 = Array.from({ length: 10 }).map((_, index) => ({ time: index * 10000, value: 92.8 + (index - 1) * 2 }));

	const series1 = chart.addSeries(ZenCharts.LineSeries);
	series1.setData(data1);

	const series2 = chart.addSeries(ZenCharts.LineSeries, {
		color: 'green',
	});
	series2.setData(data2);

	const series3 = chart.addSeries(ZenCharts.LineSeries, {
		color: 'purple',
	});
	series3.setData(data3);

	const series4 = chart.addSeries(ZenCharts.LineSeries, {
		color: 'orange',
	});
	series4.setData(data4);

	chart.timeScale().fitContent();
}
