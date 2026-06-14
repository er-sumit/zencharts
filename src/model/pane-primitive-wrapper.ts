import { IPaneView } from '../views/pane/ipane-view';

import { Coordinate } from './coordinate';
import {
    IPanePrimitiveBase,
	IPrimitivePaneView,
	PrimitiveHoveredItem,
} from './ipane-primitive';
import {
	ISeriesPrimitiveBase,
} from './iseries-primitive';
import {
	ISeriesPrimitivePaneViewWrapper,
	PrimitivePaneViewWrapper,
	RendererCache,
} from './primitive-pane-view-wrapper';

export abstract class PrimitiveWrapper<T extends ISeriesPrimitiveBase<TAttachedParameters> | IPanePrimitiveBase<TAttachedParameters>, TAttachedParameters = unknown> {
	protected readonly _primitive: T;
	private _paneViewsCache: RendererCache<readonly IPrimitivePaneView[], readonly PrimitivePaneViewWrapper[]> | null = null;

	public constructor(primitive: T) {
		this._primitive = primitive;
	}

	public primitive(): T {
		return this._primitive;
	}

	public updateAllViews(): void {
		this._primitive.updateAllViews?.();
	}

	public paneViews(): readonly ISeriesPrimitivePaneViewWrapper[] | readonly PrimitivePaneViewWrapper[] {
		const base = this._primitive.paneViews?.() ?? [];
		if (this._paneViewsCache?.base === base) {
			return this._paneViewsCache.wrapper;
		}
		const wrapper = base.map((pw: IPrimitivePaneView) => new PrimitivePaneViewWrapper(pw));
		this._paneViewsCache = {
			base,
			wrapper,
		};
		return wrapper;
	}

	public hitTest(x: Coordinate, y: Coordinate): PrimitiveHoveredItem | null {
		return this._primitive.hitTest?.(x, y) ?? null;
	}
}

export class PanePrimitiveWrapper extends PrimitiveWrapper<IPanePrimitiveBase<unknown>> {
	public labelPaneViews(): readonly IPaneView[] {
		return [];
	}
}
