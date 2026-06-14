function interactionsToPerform() {
	return [];
}

function beforeInteractions() {
	ZenCharts.createChart('container');
	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
