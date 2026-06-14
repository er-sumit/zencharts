import { IChartWidgetBase } from './chart-widget';

type LogoTheme = 'dark' | 'light';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="19" fill="none"><text x="0" y="14" fill="var(--stroke)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="bold">Zen Charts</text></svg>`;
const css = `a#zen-attr-logo{--stroke:#131722;position:absolute;left:10px;bottom:10px;height:19px;width:60px;margin:0;padding:0;border:0;z-index:3;}a#zen-attr-logo[data-dark]{--stroke:#D1D4DC;}`;

// This widget doesn't support dynamically responding to options changes
// because it is expected that the `attributionLogo` option won't be changed
// and this saves some bundle size.
export class AttributionLogoWidget {
	private readonly _chart: IChartWidgetBase;
	private readonly _container: HTMLElement;
	private _element: HTMLAnchorElement | undefined = undefined;
	private _cssElement: HTMLStyleElement | undefined = undefined;
	private _theme: LogoTheme | undefined = undefined;
	private _visible: boolean = false;

	public constructor(container: HTMLElement, chart: IChartWidgetBase) {
		this._container = container;
		this._chart = chart;
		this._render();
	}

	public update(): void {
		this._render();
	}

	public removeElement(): void {
		if (this._element) {
			this._container.removeChild(this._element);
		}
		if (this._cssElement) {
			this._container.removeChild(this._cssElement);
		}
		this._element = undefined;
		this._cssElement = undefined;
	}

	private _shouldUpdate(): boolean {
		return this._visible !== this._shouldBeVisible() || this._theme !== this._themeToUse();
	}

	private _themeToUse(): LogoTheme {
		return this._chart
			.model()
			.colorParser()
			.colorStringToGrayscale(this._chart.options()['layout'].textColor) > 160
			? 'dark'
			: 'light';
	}

	private _shouldBeVisible(): boolean {
		return this._chart.options()['layout'].attributionLogo;
	}

	private _getUTMSource(): string {
		const url = new URL(location.href);
		if (!url.hostname) {
			// ignore local testing
			return '';
		}
		return '&utm_source=' + url.hostname + url.pathname;
	}

	private _render(): void {
		if (!this._shouldUpdate()) {
			return;
		}
		this.removeElement();
		this._visible = this._shouldBeVisible();
		if (this._visible) {
			this._theme = this._themeToUse();
			this._cssElement = document.createElement('style');
			this._cssElement.innerText = css;
			this._element = document.createElement('a');
			this._element.href = `https://www.zen.com/?utm_medium=zen-link&utm_campaign=zen-chart${this._getUTMSource()}`;
			this._element.title = 'Charting by Zen';
			this._element.id = 'zen-attr-logo';
			this._element.target = '_blank';
			this._element.innerHTML = svg;
			this._element.toggleAttribute('data-dark', this._theme === 'dark');
			this._container.appendChild(this._cssElement);
			this._container.appendChild(this._element);
		}
	}
}
