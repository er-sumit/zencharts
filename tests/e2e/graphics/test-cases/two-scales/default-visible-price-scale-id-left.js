// Ignore the mouse movement because we are using setCrosshairPosition
window.ignoreMouseMove = true;

function generatePrimaryData() {
	const data = [];
	const time = new Date(Date.UTC(2020, 0, 1, 0, 0, 0, 0));

	for (let i = 0; i < 60; ++i) {
		data.push({
			time: time.getTime() / 1000,
			value: 100 + i * 1.8 + (i % 5) * 1.2,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}

	return data;
}

function generateSecondaryData() {
	const data = [];
	const time = new Date(Date.UTC(2020, 0, 1, 0, 0, 0, 0));

	for (let i = 0; i < 60; ++i) {
		data.push({
			time: time.getTime() / 1000,
			value: 1200 + i * 18 + (i % 7) * 9,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}

	return data;
}

function runTestCase(container) {
	const chart = window.chart = ZenCharts.createChart(container, {
		defaultVisiblePriceScaleId: 'left',
		leftPriceScale: {
			visible: true,
			mode: ZenCharts.PriceScaleMode.Percentage,
			borderColor: '#d1d4dc',
		},
		rightPriceScale: {
			visible: true,
			mode: ZenCharts.PriceScaleMode.Normal,
			borderColor: '#d1d4dc',
		},
		crosshair: {
			horzLine: {
				color: '#111827',
				labelBackgroundColor: '#111827',
			},
			vertLine: {
				color: '#6b7280',
				labelBackgroundColor: '#6b7280',
			},
		},
		layout: { attributionLogo: false },
	});

	const primarySeries = chart.addSeries(ZenCharts.AreaSeries, {
		topColor: 'rgba(198, 40, 40, 0.28)',
		bottomColor: 'rgba(198, 40, 40, 0.06)',
		lineColor: '#c62828',
		lineWidth: 2,
		lastValueVisible: true,
		priceLineVisible: true,
		title: 'primary-left',
	});
	const primaryData = generatePrimaryData();
	primarySeries.setData(primaryData);

	const secondarySeries = chart.addSeries(ZenCharts.HistogramSeries, {
		priceScaleId: 'right',
		color: '#1565c0',
		priceLineVisible: true,
		lastValueVisible: true,
		title: 'secondary-right',
	});
	secondarySeries.setData(generateSecondaryData());

	chart.timeScale().fitContent();

	return new Promise(resolve => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const targetPoint = primaryData[primaryData.length - 15];
				chart.setCrosshairPosition(targetPoint.value, targetPoint.time, primarySeries);
				resolve();
			});
		});
	});
}
