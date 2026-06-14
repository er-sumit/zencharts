function interactionsToPerform() {
	return [];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container, {
		timeScale: {
			visible: false,
		},
	});

	const mainSeries = chart.addSeries(ZenCharts.CandlestickSeries);

	mainSeries.setData(generateBars());

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	chart.applyOptions({
		timeScale: {
			visible: true,
		},
	});
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}
