function interactionsToPerform() {
	return [];
}

async function awaitNewFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

let candlestickSeries;

async function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container, {
		leftPriceScale: {
			visible: true,
		},
		rightPriceScale: {
			visible: true,
		},
		timeScale: {
			timeVisible: true,
		},
	});

	const lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		lineWidth: 2,
		color: '#ff0000',
		lineType: ZenCharts.LineType.Simple,
	});
	lineSeries.setData(generateLineData());

	candlestickSeries = chart.addSeries(ZenCharts.CandlestickSeries, { priceScaleId: 'left', wickColor: 'blue', borderColor: 'green' });
	const candleStickData = generateBars().map((bar, index) => {
		if (index > 5) { return bar; }
		return { ...bar, color: 'orange', wickColor: 'orange', borderColor: 'orange' };
	});
	candlestickSeries.setData(candleStickData);

	await awaitNewFrame();
	lineSeries.applyOptions({ lineType: ZenCharts.LineType.Curved });

	await awaitNewFrame();
	lineSeries.applyOptions({ lineType: ZenCharts.LineType.WithSteps });

	return Promise.resolve();
}

function afterInteractions() {
	candlestickSeries.applyOptions({
		upColor: 'transparent',
		downColor: 'rgba(-10, 0, 260, -0.1)', // incorrect rgba strings to test correction function
		borderUpColor: 'rgba(0, 0, 0, 2)',
		borderDownColor: 'black',
		wickUpColor: 'black',
		wickDownColor: 'black',
	});
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}
