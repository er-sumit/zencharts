import { IUpdatablePaneView } from '../../views/pane/iupdatable-pane-view';

import { IChartModelBase } from '../chart-model';
import { ISeries } from '../iseries';
import { LineStyleOptions } from '../series-options';
import { SeriesLinePaneView } from './line-pane-view';
import { SeriesDefinition, SeriesDefinitionInternal } from './series-def';

import { seriesLineStyleDefaults } from './series-style-defaults';

export const lineStyleDefaults: LineStyleOptions = {
	color: '#2196f3',
	...seriesLineStyleDefaults,
};

const createPaneView = (series: ISeries<'Line'>, model: IChartModelBase): IUpdatablePaneView => new SeriesLinePaneView(series, model);

export const createLineSeries = (): SeriesDefinition<'Line'> => {
	const definition: SeriesDefinitionInternal<'Line'> = {
		type: 'Line',
		isBuiltIn: true as const,
		defaultOptions: lineStyleDefaults,
		/**
		 * @internal
		 */
		createPaneView: createPaneView,
	};
	return definition as SeriesDefinition<'Line'>;
};
export const lineSeries: SeriesDefinition<'Line'> = createLineSeries();

