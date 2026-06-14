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

/*
    Start with the crosshair hidden
    then hide it
    and then show it again.
    -> Should be visible.
 */
function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		crosshair: {
			vertLine: {
				color: '#FF0000',
				width: 5,
				visible: true,
				style: 0, // solid
			},
			horzLine: {
				color: '#00FF00',
				width: 5,
				visible: true,
				style: 0, // solid
			},
			mode: ZenCharts.CrosshairMode.Normal,
		},
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(ZenCharts.LineSeries);

	mainSeries.setData(generateData());

	return new Promise(resolve => {
		setTimeout(() => {
			chart.applyOptions({
				crosshair: {
					mode: ZenCharts.CrosshairMode.Hidden,
				},
			});
			setTimeout(() => {
				chart.applyOptions({
					crosshair: {
						mode: ZenCharts.CrosshairMode.Normal,
					},
				});

				resolve();
			}, 100);
		}, 100);
	});
}
