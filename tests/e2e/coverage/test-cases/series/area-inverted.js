function interactionsToPerform() {
	return [];
}

async function awaitNewFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve);
	});
}

async function beforeInteractions(container) {
	const chart = ZenCharts.createChart(container);

	const mainSeries = chart.addSeries(ZenCharts.AreaSeries, {
		invertFilledArea: true,
	});

	mainSeries.setData(generateLineData());

	await awaitNewFrame();

	mainSeries.applyOptions({
		invertFilledArea: false,
	});

	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
