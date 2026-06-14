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
		rightPriceScale: {
			mode: ZenCharts.PriceScaleMode.IndexedTo100,
		},
		layout: { attributionLogo: false },
	});
	const lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		baseLineVisible: true,
	});
	const data = generateData();
	lineSeries.setData(data);
	ZenCharts.createSeriesMarkers(
		lineSeries,
		[
			{ time: data[data.length - 30].time, position: 'belowBar', color: 'orange', shape: 'arrowUp' },
			{ time: data[data.length - 30].time, position: 'belowBar', color: 'yellow', shape: 'arrowUp' },
			{ time: data[data.length - 30].time, position: 'belowBar', color: 'red', shape: 'arrowUp' },
			{ time: data[data.length - 20].time, position: 'aboveBar', color: 'orange', shape: 'arrowDown' },
			{ time: data[data.length - 20].time, position: 'aboveBar', color: 'yellow', shape: 'arrowDown' },
			{ time: data[data.length - 20].time, position: 'aboveBar', color: 'red', shape: 'arrowDown' },
			{ time: data[data.length - 10].time, position: 'inBar', color: 'orange', shape: 'arrowUp' },
			{ time: data[data.length - 10].time, position: 'inBar', color: 'red', shape: 'arrowDown' },
		]
	);

	return new Promise(resolve => {
		setTimeout(() => {
			lineSeries.applyOptions({
				visible: false,
			});
			requestAnimationFrame(resolve);
		}, 300);
	});
}
