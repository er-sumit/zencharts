# Zen Charts

Zen Charts is a high-performance, lightweight financial charting library, built to render massive time-series datasets seamlessly.

## Features

- **Extreme Performance**: Built on HTML5 Canvas to render tens of thousands of data points with smooth panning and zooming at 60 FPS.
- **Financial Primitives**: Native support for Candlesticks, Bar charts, Area charts, and Volume histograms.
- **Customizable**: Extensive API for customizing colors, grids, price scales, and crosshairs.
- **Plugin System**: Robust Plugin architecture to build custom drawing tools and overlays directly onto the chart's rendering context.

## Installation

Install using npm:

```bash
npm install zen-charts
```

## Basic Usage

```javascript
import { createChart, CandlestickSeries } from 'zen-charts';

const chart = createChart(document.getElementById('container'), {
    width: 600,
    height: 300,
    layout: {
        background: { type: 'solid', color: '#131722' },
        textColor: '#d1d4dc',
    },
    grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
    },
});

const candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350'
});

candlestickSeries.setData([
    { time: '2023-01-01', open: 100, high: 105, low: 95, close: 102 },
    { time: '2023-01-02', open: 102, high: 108, low: 100, close: 106 },
    { time: '2023-01-03', open: 106, high: 110, low: 104, close: 105 },
]);
```

## Drawing Tools

Unlike standard rendering libraries, Zen Charts allows for drawing tools to be built efficiently on top of the base layers using the **Zen Charts Plugin API**.

The library includes support for 15 interactive drawing tools:
- **Trend Lines**: Trend Line, Ray, Extended Line, Horizontal Line, Vertical Line, Cross Line
- **Fibonacci**: Fibonacci Retracement, Fibonacci Trend Extension
- **Geometric Shapes**: Rectangle, Parallel Channel, Triangle, Circle/Ellipse, Brush (freehand)
- **Annotations & Positions**: Text Annotation, Long/Short Position (R/R calculator)

## Technical Indicators

Includes a set of high-performance technical indicators:
- **Overlays**: Simple Moving Average (SMA), Exponential Moving Average (EMA), Bollinger Bands
- **Panes/Histograms**: Volume, Relative Strength Index (RSI), MACD (Moving Average Convergence Divergence)

## License & Attribution

Zen Charts is licensed under the Apache License 2.0.

Inspired by TradingView Lightweight Charts. from open-source code 
originally developed by TradingView, Inc., licensed under 
the Apache License 2.0. See the LICENSE and NOTICE files 
for details.
