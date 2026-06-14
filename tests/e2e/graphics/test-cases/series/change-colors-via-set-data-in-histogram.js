function generateData(colors) {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < 30; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: i,
			color: colors[i % colors.length],
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, { layout: { attributionLogo: false } });

	const mainSeries = chart.addSeries(ZenCharts.HistogramSeries);

	mainSeries.setData(generateData([
		'red',
		'blue',
	]));

	return new Promise(resolve => {
		setTimeout(() => {
			mainSeries.setData(generateData([
				'black',
				'green',
			]));

			resolve();
		}, 500);
	});
}
