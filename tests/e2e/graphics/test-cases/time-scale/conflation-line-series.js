function generateData(count) {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < count; ++i) {
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
		timeScale: {
			enableConflation: true,
			precomputeConflationOnInit: true,
			barSpacing: container.clientWidth / window.devicePixelRatio / 40000,
			minBarSpacing: container.clientWidth / 3 / 40000, // make all data visible
		},
		layout: { attributionLogo: false },
	});

	const lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		color: '#2196F3',
		lineWidth: 2,
	});

	// Generate 40k data points
	const data = generateData(40000);
	lineSeries.setData(data);

	// Fit all data in view
	chart.timeScale().fitContent();
}
