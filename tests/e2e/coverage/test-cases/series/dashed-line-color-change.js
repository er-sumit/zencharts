function interactionsToPerform() {
	return [];
}

async function awaitNewFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

let lineSeries;
let areaSeries;
let baselineSeries;

async function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	const lineDataWithColors = generateLineData().map((item, index) => ({
		...item,
		color: index % 5 === 0 ? 'green' : 'purple',
	}));

	lineSeries = chart.addSeries(ZenCharts.LineSeries, {
		lineWidth: 2,
		lineStyle: ZenCharts.LineStyle.Dashed,
		color: '#ff0000',
	});
	lineSeries.setData(lineDataWithColors);

	await awaitNewFrame();
	lineSeries.applyOptions({ lineStyle: ZenCharts.LineStyle.Dotted });
	await awaitNewFrame();
	lineSeries.applyOptions({ lineStyle: ZenCharts.LineStyle.LargeDashed });
	await awaitNewFrame();
	lineSeries.applyOptions({ lineStyle: ZenCharts.LineStyle.SparseDotted });

	areaSeries = chart.addSeries(ZenCharts.AreaSeries, {
		lineWidth: 2,
		lineStyle: ZenCharts.LineStyle.Dashed,
		lineColor: '#ff0000',
		topColor: 'rgba(255, 0, 0, 0.3)',
		bottomColor: 'rgba(255, 0, 0, 0.05)',
	});
	areaSeries.setData(lineDataWithColors);

	baselineSeries = chart.addSeries(ZenCharts.BaselineSeries, {
		baseValue: { type: 'price', price: 50 },
		lineWidth: 2,
		lineStyle: ZenCharts.LineStyle.Dashed,
	});
	baselineSeries.setData(generateLineData());

	return Promise.resolve();
}

async function afterInteractions() {
	lineSeries.applyOptions({ lineType: ZenCharts.LineType.WithSteps });
	await awaitNewFrame();
	lineSeries.applyOptions({ lineType: ZenCharts.LineType.Curved });
	await awaitNewFrame();
	areaSeries.applyOptions({ lineStyle: ZenCharts.LineStyle.SparseDotted });
	await awaitNewFrame();
	baselineSeries.applyOptions({ lineStyle: ZenCharts.LineStyle.LargeDashed });
	await awaitNewFrame();
}
