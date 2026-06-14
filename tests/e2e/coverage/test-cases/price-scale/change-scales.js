function interactionsToPerform() {
	return [];
}

async function awaitNewFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

let mainSeries;
let chart;

async function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);

	mainSeries = chart.addSeries(ZenCharts.LineSeries);
	mainSeries.setData(generateLineData());

	await awaitNewFrame();
	chart.priceScale('right').applyOptions({
		mode: ZenCharts.PriceScaleMode.Percentage,
		invertScale: true,
	});

	await awaitNewFrame();
	chart.priceScale('right').applyOptions({
		mode: ZenCharts.PriceScaleMode.IndexedTo100,
		invertScale: false,
	});

	await awaitNewFrame();
	chart.priceScale('right').applyOptions({
		mode: ZenCharts.PriceScaleMode.Logarithmic,
	});

	await awaitNewFrame();
	chart.priceScale('right').applyOptions({
		mode: ZenCharts.PriceScaleMode.Normal,
	});

	return Promise.resolve();
}

function afterInteractions() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}
