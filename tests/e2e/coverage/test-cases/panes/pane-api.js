function simpleData() {
	return [
		{ time: 1663740000, value: 10 },
		{ time: 1663750000, value: 20 },
		{ time: 1663760000, value: 30 },
	];
}

function interactionsToPerform() {
	return [];
}

let chart;
let secondSeries;
function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.LineSeries);
	const pane1 = chart.addPane(true);
	secondSeries = pane1.addSeries(ZenCharts.LineSeries);
	const thirdSeries = chart.addSeries(ZenCharts.LineSeries, {}, 2);

	mainSeries.setData(simpleData());
	secondSeries.setData(simpleData());
	thirdSeries.setData(simpleData());

	return Promise.resolve();
}

function afterInteractions() {
	return new Promise(resolve => {
		requestAnimationFrame(() => {
			const panes = chart.panes();
			panes[1].getHeight();
			panes[1].paneIndex();
			panes[2].setHeight(100);
			panes[0].setStretchFactor(200);
			panes[1].getStretchFactor();
			panes[0].moveTo(2);
			panes[0].getHTMLElement();
			panes[1].getSeries();

			requestAnimationFrame(resolve);
		});
	});
}
