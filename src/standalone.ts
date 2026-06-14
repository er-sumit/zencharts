// eslint-disable-next-line @typescript-eslint/naming-convention
import * as ZenChartsModule from './index';

// put all exports from package to window.ZenCharts object
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
(window as any).ZenCharts = ZenChartsModule;
