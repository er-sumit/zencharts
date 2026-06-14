function dataItem(date, val) {
	return {
		value: val,
		time: new Date(date).getTime() / 1000,
	};
}

function getData() {
	return [
		dataItem('2019-12-31', 10),
		dataItem('2020-01-01', 20), // year
		dataItem('2020-02-01', 30), // month
		dataItem('2020-02-03', 10), // day
		dataItem('2020-02-03T01:00:00.000Z', 20), // hour
		dataItem('2020-02-03T01:01:00.000Z', 67), // time
		dataItem('2020-02-03T01:01:01.000Z', 99), // seconds
	];
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		timeScale: {
			timeVisible: true,
			secondsVisible: true,
			tickMarkFormatter: (time, tickMarkType, locale) => {
				const date = ZenCharts.isBusinessDay(time)
					? new Date(Date.UTC(time.year, time.month - 1, time.day))
					: new Date(time * 1000);

				switch (tickMarkType) {
					case ZenCharts.TickMarkType.Year:
						return 'Y' + date.getUTCFullYear();

					case ZenCharts.TickMarkType.Month:
						return 'M' + (date.getUTCMonth() + 1);

					case ZenCharts.TickMarkType.DayOfMonth:
						return 'D' + date.getUTCDate();

					case ZenCharts.TickMarkType.Time:
						return 'T' + date.getUTCHours() + ':' + date.getUTCMinutes();

					case ZenCharts.TickMarkType.TimeWithSeconds:
						return 'S' + date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds();
				}

				throw new Error('unhandled tick mark type ' + tickMarkType);
			},
		},
		layout: { attributionLogo: false },
	});

	const firstSeries = chart.addSeries(ZenCharts.LineSeries);
	firstSeries.setData(getData());
	chart.timeScale().fitContent();
}
