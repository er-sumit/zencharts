/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { DrawingManager } from '../../src/tools/drawing/DrawingManager';
import { DrawingPrimitive, Drawing } from '../../src/tools/drawing/DrawingPrimitive';
import { Time } from '../../src/model/horz-scale-behavior-time/types';

// Mock implementations
class MockTimeScale {
	public logicalToCoordinateVal: number | null = 100;
	public coordinateToLogicalVal: number | null = 1;
	public timeToCoordinateVal: number | null = 100;

	coordinateToLogical(x: number) { return this.coordinateToLogicalVal; }
	logicalToCoordinate(logical: any) { return this.logicalToCoordinateVal; }
	timeToCoordinate(time: any) { return this.timeToCoordinateVal; }
}

class MockSeries {
	public coordinateToPriceVal: number | null = 50;
	public priceToCoordinateVal: number | null = 100;

	coordinateToPrice(y: number) { return this.coordinateToPriceVal; }
	priceToCoordinate(price: number) { return this.priceToCoordinateVal; }
}

class MockChart {
	public element = { style: {} } as any;
	public timeScaleObj = new MockTimeScale();
	public clickCallback: any;
	public crosshairCallback: any;
	public optionsObj = {
		trackingMode: { exitMode: 1 }
	};

	chartElement() { return this.element; }
	subscribeClick(cb: any) { this.clickCallback = cb; }
	unsubscribeClick(cb: any) {}
	subscribeCrosshairMove(cb: any) { this.crosshairCallback = cb; }
	unsubscribeCrosshairMove(cb: any) {}
	timeScale() { return this.timeScaleObj; }
	applyOptions(options: any) {}
	options() { return this.optionsObj; }
}

function setupManager() {
	const chart = new MockChart() as any;
	const series = new MockSeries() as any;
	const primitive = new DrawingPrimitive();
	primitive.attached({ chart, series, requestUpdate: () => {} });
	const manager = new DrawingManager(chart, series, primitive);
	return { chart, series, primitive, manager };
}

describe('DrawingManager', () => {
	it('exportDrawings and importDrawings', () => {
		const { manager } = setupManager();
		const drawings: Drawing[] = [
			{
				id: 'd1',
				type: 'trendline',
				points: [
					{ time: 1577836800 as Time, price: 100 },
					{ time: 1577923200 as Time, price: 110 }
				],
				options: { lineColor: '#ff0000', width: 2 }
			}
		];
		manager.setDrawings(drawings);

		const exported = manager.exportDrawings();
		expect(exported.version).to.equal(1);
		expect(exported.drawings.length).to.equal(1);
		expect(exported.drawings[0].id).to.equal('d1');

		// Import
		const newSetup = setupManager();
		newSetup.manager.importDrawings(exported);
		expect(newSetup.manager.drawings.length).to.equal(1);
		expect(newSetup.manager.drawings[0].id).to.equal('d1');
		expect(newSetup.manager.drawings[0].options.lineColor).to.equal('#ff0000');
	});

	it('import legacy drawings format', () => {
		const { manager } = setupManager();
		const legacy = [
			{
				type: 'trendline',
				points: [
					{ time: 1577836800 as Time, price: 100 },
					{ time: 1577923200 as Time, price: 110 }
				],
				options: { lineColor: '#ff0000' }
			}
		] as any;

		manager.importDrawings(legacy);
		expect(manager.drawings.length).to.equal(1);
		expect(manager.drawings[0].id).to.not.be.undefined;
		expect(manager.drawings[0].id.length).to.be.greaterThan(0);
	});

	it('overlapping drawing selection selects top-most first', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {}
		};
		const d2: Drawing = {
			id: 'd2',
			type: 'trendline',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {}
		};
		manager.setDrawings([d1, d2]);

		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);
		primitive.renderedPoints.set('d2', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

		const hit = manager.mouseDownEvent({
			localX: 150 as any,
			localY: 150 as any,
		} as any);

		expect(hit).to.be.true;
		expect(manager.drawings.find(d => d.id === 'd2')?.selected).to.be.true;
		expect(manager.drawings.find(d => d.id === 'd1')?.selected).to.be.false;
	});

	it('handle priority over body selection', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {},
			selected: true
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

		const hit = manager.mouseDownEvent({
			localX: 100 as any,
			localY: 100 as any,
		} as any);

		expect(hit).to.be.true;
		expect((manager as any)._dragMode).to.equal('handle');
		expect((manager as any)._draggedDrawingId).to.equal('d1');
		expect((manager as any)._draggedPointIndex).to.equal(0);
	});

	it('mobile-expanded touch hit areas vs mouse precision', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {},
			selected: true
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

		// 1. Desktop mouse down at 15px distance from handle (100, 100) -> misses
		let hitMouse = manager.mouseDownEvent({
			localX: 115 as any,
			localY: 100 as any,
		} as any);
		expect((manager as any)._dragMode).to.not.equal('handle');

		// Re-select drawing since hitMouse deselected it
		manager.drawings[0].selected = true;

		// 2. Mobile touch start at 21px distance from handle (100, 100) -> hits
		let hitTouch = manager.touchStartEvent({
			localX: 121 as any,
			localY: 100 as any,
		} as any);

		expect(hitTouch).to.be.true;
		expect((manager as any)._dragMode).to.equal('handle');
		expect((manager as any)._draggedPointIndex).to.equal(0);
	});

	it('weak magnet snap threshold behavior', () => {
		const { manager, chart, series } = setupManager();
		const data = [{
			time: 1577836800 as Time,
			open: 100,
			high: 105,
			low: 95,
			close: 101
		}];
		manager.setSeriesData(data);
		manager.setMagnetModeType('weak');
		manager.setWeakMagnetThresholdPx(30);

		(manager as any)._crosshairTime = 1577836800 as Time;
		series.priceToCoordinateVal = 100;

		// 1. Inside threshold: cursor coordinate Y is 120 (distance is 20px <= 30px)
		series.coordinateToPriceVal = 99;
		chart.crosshairCallback({
			point: { x: 50, y: 120 }
		});
		expect((manager as any)._crosshairPrice).to.equal(100); // snaps to closest level (open = 100)

		// 2. Outside threshold: cursor coordinate Y is 140 (distance is 40px > 30px)
		series.coordinateToPriceVal = 97;
		chart.crosshairCallback({
			point: { x: 50, y: 140 }
		});
		expect((manager as any)._crosshairPrice).to.equal(97); // does not snap
	});

	it('preserves normal chart pan when touch is outside drawing hit zones', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

		const hit = manager.touchStartEvent({
			localX: 300 as any,
			localY: 300 as any,
		} as any);

		expect(hit).to.be.false;
	});

	it('cross drawing hit-testing and selection', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'cross',
			points: [{ time: 1 as Time, price: 50 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }]);

		let hit = manager.mouseDownEvent({ localX: 100, localY: 100 } as any);
		expect(hit).to.be.true;
		expect(manager.drawings[0].selected).to.be.true;

		manager.drawings[0].selected = false;
		hit = manager.mouseDownEvent({ localX: 150, localY: 100 } as any);
		expect(hit).to.be.true;
		expect(manager.drawings[0].selected).to.be.true;

		manager.drawings[0].selected = false;
		hit = manager.mouseDownEvent({ localX: 100, localY: 150 } as any);
		expect(hit).to.be.true;
		expect(manager.drawings[0].selected).to.be.true;
	});

	it('parallel_channel hit-testing on segment and inside area', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'parallel_channel',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }, { time: 1 as Time, price: 20 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 150 }]);

		let hit = manager.mouseDownEvent({ localX: 150, localY: 100 } as any);
		expect(hit).to.be.true;

		manager.drawings[0].selected = false;
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 150 }]);
		hit = manager.mouseDownEvent({ localX: 150, localY: 150 } as any);
		expect(hit).to.be.true;

		manager.drawings[0].selected = false;
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 150 }]);
		hit = manager.mouseDownEvent({ localX: 150, localY: 125 } as any);
		expect(hit).to.be.true;
	});

	it('rotated_rectangle inside check quadrant projection', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'rotated_rectangle',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }, { time: 1 as Time, price: 20 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 150 }]);

		const hit = manager.mouseDownEvent({ localX: 150, localY: 125 } as any);
		expect(hit).to.be.true;
	});

	it('measure tool box border and inside hit-testing', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'measure',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

		let hit = manager.mouseDownEvent({ localX: 180, localY: 120 } as any);
		expect(hit).to.be.true;
	});

	it('long_position entry target stop levels and inside box hit-testing', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'long_position',
			points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 20 }, { time: 1 as Time, price: 5 }],
			options: {}
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 50 }, { x: 100, y: 150 }]);

		let hit = manager.mouseDownEvent({ localX: 150, localY: 150 } as any);
		expect(hit).to.be.true;

		manager.drawings[0].selected = false;
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 50 }, { x: 100, y: 150 }]);
		hit = manager.mouseDownEvent({ localX: 150, localY: 75 } as any);
		expect(hit).to.be.true;

		manager.drawings[0].selected = false;
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 50 }, { x: 100, y: 150 }]);
		hit = manager.mouseDownEvent({ localX: 150, localY: 125 } as any);
		expect(hit).to.be.true;
	});

	it('text hit-testing using measured text bounds and alignment check', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'text',
			points: [{ time: 1 as Time, price: 50 }],
			options: { text: 'Hello World', fontSize: 16, fillColor: '#00ff00' }
		};
		manager.setDrawings([d1]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }]);

		primitive.textBounds.set('d1', { width: 80, height: 16 });

		let hit = manager.mouseDownEvent({ localX: 150, localY: 90 } as any);
		expect(hit).to.be.true;

		manager.drawings[0].selected = false;
		hit = manager.mouseDownEvent({ localX: 150, localY: 120 } as any);
		expect(hit).to.be.false;
	});

	it('overlapping hover prioritizes top-most drawing', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = { id: 'd1', type: 'trendline', points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }], options: {} };
		const d2: Drawing = { id: 'd2', type: 'trendline', points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }], options: {} };
		manager.setDrawings([d1, d2]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }]);
		primitive.renderedPoints.set('d2', [{ x: 100, y: 100 }, { x: 200, y: 100 }]);

		// Send crosshair move over the overlapping lines
		manager['_handleCrosshairMove']({ point: { x: 150, y: 100 } } as any);
		expect(manager['_hoveredDrawingId']).to.equal('d2'); // d2 was added last, so it is top-most
	});

	it('overlapping handle priority prioritizes top-most drawing handles', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = { id: 'd1', type: 'trendline', points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }], options: {}, selected: true };
		const d2: Drawing = { id: 'd2', type: 'trendline', points: [{ time: 1 as Time, price: 10 }, { time: 2 as Time, price: 10 }], options: {}, selected: true };
		manager.setDrawings([d1, d2]);
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 200, y: 100 }]);
		primitive.renderedPoints.set('d2', [{ x: 100, y: 100 }, { x: 200, y: 100 }]);

		// Click on handle (100, 100)
		const hit = manager.mouseDownEvent({ localX: 100, localY: 100 } as any);
		expect(hit).to.be.true;
		expect(manager['_draggedDrawingId']).to.equal('d2'); // d2 has priority
		expect(manager['_draggedPointIndex']).to.equal(0);
	});

	it('logical-index gap-preservation drag shifts drawing points keeping bar distance constant', () => {
		const { manager, primitive, chart } = setupManager();
		chart.timeScaleObj.coordinateToLogicalVal = 0;
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1000 as Time, price: 10 }, { time: 4000 as Time, price: 10 }],
			options: {}
		};
		manager.setDrawings([d1]);
		
		// Setup mock series data with weekend gaps:
		// time index 0: 1000, index 1: 2000, index 2: 4000 (gap of 2000 between index 1 and 2)
		manager.setSeriesData([
			{ time: 1000 },
			{ time: 2000 },
			{ time: 4000 }
		]);

		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 300, y: 100 }]);

		// Click to start drag body on d1 at coordinate (100, 100) which has time 1000
		manager['_crosshairTime'] = 1000 as Time;
		manager['_crosshairPrice'] = 10;
		let hit = manager.mouseDownEvent({ localX: 150, localY: 100 } as any);
		expect(hit).to.be.true;
		expect(manager['_dragMode']).to.equal('body');
		expect(manager['_draggedDrawingId']).to.equal('d1');

		// Assert that useLogical is active and offsets are computed in bar indices
		const offsets = manager['_bodyDragOffsets'];
		expect(offsets[0].useLogical).to.be.true;
		expect(offsets[0].dLogical).to.equal(0);
		expect(offsets[1].dLogical).to.equal(2);

		// Drag to cursor position index 1 (time 2000)
		manager['_crosshairTime'] = 2000 as Time;
		manager['_crosshairPrice'] = 10;
		manager['_handleDragMove']();

		const updated = manager.drawings[0];
		expect(updated.points[0].time).to.equal(2000);
		expect(updated.points[1].time).to.equal(6000);
	});

	it('fallback time-based drag moves points using absolute time when series data is empty', () => {
		const { manager, primitive } = setupManager();
		const d1: Drawing = {
			id: 'd1',
			type: 'trendline',
			points: [{ time: 1000 as Time, price: 10 }, { time: 3000 as Time, price: 10 }],
			options: {}
		};
		manager.setDrawings([d1]);
		
		// Do not call setSeriesData: seriesData is empty.
		primitive.renderedPoints.set('d1', [{ x: 100, y: 100 }, { x: 300, y: 100 }]);

		manager['_crosshairTime'] = 1000 as Time;
		manager['_crosshairPrice'] = 10;
		const hit = manager.mouseDownEvent({ localX: 150, localY: 100 } as any);
		expect(hit).to.be.true;

		const offsets = manager['_bodyDragOffsets'];
		expect(offsets[0].useLogical).to.be.false;
		expect(offsets[0].dTime).to.equal(0);
		expect(offsets[1].dTime).to.equal(2000);

		// Drag to time 2000
		manager['_crosshairTime'] = 2000 as Time;
		manager['_crosshairPrice'] = 10;
		manager['_handleDragMove']();

		const updated = manager.drawings[0];
		expect(updated.points[0].time).to.equal(2000);
		expect(updated.points[1].time).to.equal(4000);
	});

	it('deleteSelected and clearAll do not crash in headless test environment', () => {
		const { manager } = setupManager();
		const d1: Drawing = { id: 'd1', type: 'trendline', points: [{ time: 1 as Time, price: 10 }], options: { locked: true }, selected: true };
		manager.setDrawings([d1]);

		// Call deleteSelected and clearAll on locked drawing without defined window.confirm.
		// It should safely bypass the confirmation and do nothing (for deleteSelected) or just complete safely.
		expect(() => manager.deleteSelected()).to.not.throw();
		expect(manager.drawings.length).to.equal(1); // was locked, confirmation omitted/failed, so not deleted

		expect(() => manager.clearAll()).to.not.throw();
		expect(manager.drawings.length).to.equal(1); // clearAll has locked drawing, confirmation omitted, so not cleared
	});
});
