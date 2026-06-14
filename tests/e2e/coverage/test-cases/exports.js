function interactionsToPerform() {
	return [];
}

function beforeInteractions() {
	console.log(ZenCharts.TrackingModeExitMode);
	console.log(ZenCharts.MismatchDirection);
	console.log(ZenCharts.PriceLineSource);
	console.log(ZenCharts.TickMarkType);
	console.log(ZenCharts.version());
	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
