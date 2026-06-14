function interactionsToPerform() {
	return [];
}

let chart;

function beforeInteractions(container) {
	chart = ZenCharts.createChart(container);
	return Promise.resolve();
}

function afterInteractions() {
	chart.remove();
	chart = null;
	return Promise.resolve();
}
