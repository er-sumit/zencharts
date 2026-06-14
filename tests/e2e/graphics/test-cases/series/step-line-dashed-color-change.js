function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));

	for (let i = 0; i < 30; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: 20 + (i % 5) * 15,
			// Alternate colors to test dash continuity across color changes
			color: i % 4 === 0 ? 'green' : 'purple',
		});
		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(ZenCharts.LineSeries, {
		lineWidth: 2,
		lineType: ZenCharts.LineType.WithSteps,
		lineStyle: ZenCharts.LineStyle.Dashed,
		color: '#ff0000',
	});

	mainSeries.setData(generateData());

	chart.timeScale().fitContent();
}
