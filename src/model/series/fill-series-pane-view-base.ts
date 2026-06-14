import { IChartModelBase } from '../../model/chart-model';
import { ISeries } from '../../model/iseries';
import { IPaneRenderer } from '../../renderers/ipane-renderer';
import { PricedValue } from '../price-scale';
import { TimedValue } from '../time-data';
import { HoveredSourcePaneViews } from '../../views/pane/hovered-source-pane-views';
import { IPaneView } from '../../views/pane/ipane-view';

import { FillSeriesCompositeRenderer, FillSeriesLinePaneView } from './fill-series-hovered-pane-view';
import { LineHitTestPaneViewBase } from './line-hit-test-pane-view-base';

export abstract class FillSeriesPaneViewBase<
	TSeriesType extends 'Area' | 'Baseline',
	ItemType extends PricedValue & TimedValue
> extends LineHitTestPaneViewBase<TSeriesType, ItemType, FillSeriesCompositeRenderer> {
	protected readonly _renderer: FillSeriesCompositeRenderer;
	private readonly _linePaneView: FillSeriesLinePaneView;
	private readonly _normalPaneViews: readonly IPaneView[];
	private readonly _topPaneViews: readonly IPaneView[];
	private readonly _hoveredSourcePaneViews: HoveredSourcePaneViews;

	public constructor(
		series: ISeries<TSeriesType>,
		model: IChartModelBase,
		fillRenderer: IPaneRenderer,
		lineRenderer: IPaneRenderer
	) {
		super(series, model);

		this._linePaneView = new FillSeriesLinePaneView(
			lineRenderer,
			() => this._shouldDrawLine()
		);
		this._normalPaneViews = [this];
		this._topPaneViews = [this._linePaneView];
		this._hoveredSourcePaneViews = {
			normalPaneViews: this._normalPaneViews,
			topPaneViews: this._topPaneViews,
		};

		this._renderer = new FillSeriesCompositeRenderer(
			fillRenderer,
			lineRenderer,
			() => this._shouldDrawLine(),
			() => this._model.options().hoveredSeriesOnTop
		);
	}

	public paneViewsForHoveredSourceOnTop(): HoveredSourcePaneViews | null {
		return this._hoveredSourcePaneViews;
	}

	protected _shouldDrawLine(): boolean {
		return this._series.visible() &&
			this._itemsVisibleRange !== null &&
			this._hasVisibleLineLikeContent();
	}

	protected _hasVisibleLineLikeContent(): boolean {
		const options = this._series.options();
		// Both Area and Baseline extend SeriesLineStyleProperties which guarantees these fields exist
		// However, SeriesOptionsMap[TSeriesType] does not strictly resolve them statically in TypeScript without casting
		return (options as any).lineVisible || (options as any).pointMarkersVisible;
	}
}
