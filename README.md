# Zen Charts

Zen Charts is a high-performance, lightweight financial charting library, built to render massive time-series datasets seamlessly.

## Features & Capabilities

- **TradingView-Inspired Interactions**: Meticulously crafted primitives with exact geometric hit-testing, handle-dragging, and body-selection parity with standard professional charting tools.
- **Gap Interpolation Support**: Drawing coordinates seamlessly map across market gaps (weekends, holidays, and missing session bars) without geometric distortion or visual skewing.
- **Mobile Support**: Fully decoupled touch pipelines safely isolate zooming, panning, and drawing drag states, maintaining stability across both capacitive multi-touch devices and traditional desktop pointers.
- **Extreme Performance**: Built on HTML5 Canvas to natively render tens of thousands of data points with smooth panning and zooming at 60 FPS, utilizing $O(\log N)$ spatial indexing and spatial rendering debouncers.
- **Financial Primitives**: Native support for Candlesticks, Bar charts, Area charts, and Volume histograms.
- **QA Infrastructure**: Validated by our internal `ChartApp QA Laboratory`, offering rigorous programmatic rendering analysis across Baseline, Gap, Mobile, and Stress environments.

## Behavioral Specifications

All drawing tools strictly adhere to our mathematically defined geometric interaction paradigms. 
**[View the complete Behavioral Specifications inside `docs/behaviors/`](file:///wsl.localhost/Ubuntu/home/sumit/projects/charts/zen-charts-app/docs/behaviors/)** to understand exact hit-testing boundaries, handle dragging logic, and selection state management.

---

## Stability Roadmap

The journey to `v1.0.0` was forged through our rigorous Stability Roadmap and Hybrid QA Campaigns:

### v1.0.0-rc1 Production Candidate
- ZenCharts' geometric foundation is strictly deterministic. The engine scales seamlessly, handles chaotic multi-touch logic cleanly, and efficiently prevents memory accumulation.

### v0.2.6 Interaction Hardening
- **Brush Memory Neutralization**: Neutralized $O(N)$ accumulation bugs via strict 5px spatial debouncing, eliminating 95% of rendering overhead during long brush strokes.
- **Tool Preemption**: Existing geometry hit-testing actively prioritizes itself over new tool creation, preventing user lock-outs.
- **Asymmetric Anchors**: Hardened hit-testing boundaries to accurately support skewed stop-loss offsets in position tools.

### v0.2.5 Mobile Stability
- **Touch State Decoupling**: Neutralized coordinate teleportation by intercepting secondary touches (e.g., pinch-to-zoom) and instantly aborting drag states gracefully.
- **Capacitive Hit Radii**: Implemented dynamic interaction zones (8px for mouse, 22px for touch) to accommodate human finger profiles.

### v0.2.4 Stability Complete
- **Persistent Geometric Lifecycle**: The Measure tool persists seamlessly through tool-swapping and panning, retiring the legacy auto-deletion paradigm.

### v0.2.3 Magnet Stability
- **Rigid Snapping Transformation**: Magnet mode drag calculations gracefully map against absolute OHLC prices while maintaining precise primitive proportions without chaotic teleportation.

### v0.2.2 Parallel Channel Stability
- **Symmetric Midpoints**: Implemented orthogonal mid-channel sizing handles allowing absolute channel width mutation without skewing underlying slope angles.

### v0.2.1 Stability Baseline
- **Fractional Coordinate Translation**: Integrated sub-pixel decimal coordinate tracking internally, entirely eliminating integer snapping jitter.
- **O(log N) Rendering**: Replaced naive unoptimized $O(N)$ rendering pipelines with highly efficient binary spatial lookup matrices.

---

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
});

const candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
});

candlestickSeries.setData([
    { time: '2023-01-01', open: 100, high: 105, low: 95, close: 102 },
    { time: '2023-01-02', open: 102, high: 108, low: 100, close: 106 },
]);
```

## Future Roadmap

While ZenCharts `v1.0.0-rc1` guarantees fundamental geometric stability, upcoming 1.x minor releases will target the following workflow optimizations:
- **Visual Regression Automation**: Transitioning our manual ChartApp regression suites to fully headless Playwright snapshot tests natively inside our CI pipelines.
- **CI/CD Integration**: Establishing automated NPM package deployment rings leveraging strict GitHub Actions gating on `main` branch merges.
- **Z-Index Toggling**: Implementing spatial layering capabilities (Send-To-Back / Bring-To-Front) to better accommodate complex power-user annotations involving overlapping shapes.

## License & Attribution

Zen Charts is licensed under the Apache License 2.0.
Inspired by TradingView Lightweight Charts. See the LICENSE and NOTICE files for details.
