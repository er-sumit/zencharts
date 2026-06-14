function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < 500; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: i,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}

	return res;
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		layout: {
			background: {
				type: ZenCharts.ColorType.VerticalGradient,
				topColor: '#b1ff73',
				bottomColor: '#1106b1',
			},
			attributionLogo: false,
		},
	});

	const series = chart.addSeries(ZenCharts.LineSeries, {
		title: 'ABCD',
	});

	series.setData(generateData());
}
