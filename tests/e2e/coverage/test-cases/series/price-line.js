function interactionsToPerform() {
	return [];
}

let mainSeries;
let priceLineToRemove;
let priceLine1;

function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	mainSeries = chart.addSeries(ZenCharts.BarSeries);

	mainSeries.setData(generateBars());

	mainSeries.createPriceLine({
		price: 10,
		color: 'red',
		lineWidth: 1,
		lineStyle: ZenCharts.LineStyle.Solid,
	});

	mainSeries.createPriceLine({
		price: 20,
		color: '#00FF00',
		lineWidth: 2,
		lineStyle: ZenCharts.LineStyle.Dotted,
	});

	mainSeries.createPriceLine({
		price: 30,
		color: 'rgb(0,0,255)',
		lineWidth: 3,
		lineStyle: ZenCharts.LineStyle.Dashed,
	});

	priceLineToRemove = mainSeries.createPriceLine({
		price: 40,
		color: 'rgba(255,0,0,0.5)',
		lineWidth: 4,
		lineStyle: ZenCharts.LineStyle.LargeDashed,
	});

	priceLine1 = mainSeries.createPriceLine({
		price: 50,
		color: '#f0f',
		lineWidth: 4,
		lineStyle: ZenCharts.LineStyle.SparseDotted,
		axisLabelTextColor: '#d04488',
		axisLabelColor: '#00DDDD',
	});

	priceLine1.options();

	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

function afterInteractions() {
	mainSeries.removePriceLine(priceLineToRemove);
	priceLine1.applyOptions({});

	return Promise.resolve();
}
