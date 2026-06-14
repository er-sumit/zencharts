import { CanvasRenderingTarget2D } from 'fancy-canvas';

import { IPaneRenderer } from '../renderers/ipane-renderer';
import { IPaneView } from '../views/pane/ipane-view';

import {
	IPrimitivePaneRenderer,
	IPrimitivePaneView,
	PrimitivePaneViewZOrder,
} from './ipane-primitive';
import { drawingUtils } from './primitive-drawing-utils';

export class PrimitiveRendererWrapper implements IPaneRenderer {
	private readonly _baseRenderer: IPrimitivePaneRenderer;

	public constructor(baseRenderer: IPrimitivePaneRenderer) {
		this._baseRenderer = baseRenderer;
	}

	public draw(target: CanvasRenderingTarget2D, isHovered: boolean, hitTestData?: unknown): void {
		this._baseRenderer.draw(target, drawingUtils);
	}

	public drawBackground?(target: CanvasRenderingTarget2D, isHovered: boolean, hitTestData?: unknown): void {
		this._baseRenderer.drawBackground?.(target, drawingUtils);
	}
}

export interface RendererCache<Base, Wrapper> {
	base: Base;
	wrapper: Wrapper;
}

export interface ISeriesPrimitivePaneViewWrapper extends IPaneView {
	zOrder(): PrimitivePaneViewZOrder;
}

export class PrimitivePaneViewWrapper implements IPaneView {
	private readonly _paneView: IPrimitivePaneView;
	private _cache: RendererCache<IPrimitivePaneRenderer, PrimitiveRendererWrapper> | null = null;

	public constructor(paneView: IPrimitivePaneView) {
		this._paneView = paneView;
	}

	public renderer(): IPaneRenderer | null {
		const baseRenderer = this._paneView.renderer();
		if (baseRenderer === null) {
			return null;
		}
		if (this._cache?.base === baseRenderer) {
			return this._cache.wrapper;
		}
		const wrapper = new PrimitiveRendererWrapper(baseRenderer);
		this._cache = {
			base: baseRenderer,
			wrapper,
		};
		return wrapper;
	}

	public zOrder(): PrimitivePaneViewZOrder {
		return this._paneView.zOrder?.() ?? 'normal';
	}
}
