import { ensureNotNull } from '../helpers/assertions';
import { updateObjectPool } from '../helpers/update-object-pool';
import { TimeMark, TimeScale } from './time-scale';

const defaultTickMarkMaxCharacterLength = 8;

export class TimeTickMarkBuilder<HorzScaleItem> {
	private readonly _timeScale: TimeScale<HorzScaleItem>;
	private _labels: TimeMark[] = [];
	private _timeMarksCache: TimeMark[] | null = null;

	public constructor(timeScale: TimeScale<HorzScaleItem>) {
		this._timeScale = timeScale;
	}

	public marks(): TimeMark[] | null {
		if (this._timeScale.isEmpty()) {
			return null;
		}

		if (this._timeMarksCache !== null) {
			return this._timeMarksCache;
		}

		const spacing = this._timeScale.barSpacing();
		const fontSize = this._timeScale.model().options()['layout'].fontSize;

		const pixelsPer8Characters = (fontSize + 4) * 5;
		const pixelsPerCharacter = pixelsPer8Characters / defaultTickMarkMaxCharacterLength;
		const maxLabelWidth = pixelsPerCharacter * (this._timeScale.options().tickMarkMaxCharacterLength || defaultTickMarkMaxCharacterLength);
		const indexPerLabel = Math.round(maxLabelWidth / spacing);

		const visibleBars = ensureNotNull(this._timeScale.visibleStrictRange());

		const firstBar = Math.max(visibleBars.left(), visibleBars.left() - indexPerLabel);
		const lastBar = Math.max(visibleBars.right(), visibleBars.right() - indexPerLabel);

		const items = this._timeScale.tickMarks().build(
			spacing,
			maxLabelWidth,
			this._timeScale.options().ignoreWhitespaceIndices,
			this._timeScale.indicesWithData(),
			this._timeScale.indicesWithDataUpdateId()
		);

		// according to indexPerLabel value this value means "earliest index which _might be_ used as the second label on time scale"
		const earliestIndexOfSecondLabel = (this._timeScale.firstIndex() as number) + indexPerLabel;

		// according to indexPerLabel value this value means "earliest index which _might be_ used as the second last label on time scale"
		const indexOfSecondLastLabel = (this._timeScale.lastIndex() as number) - indexPerLabel;

		const isAllScalingAndScrollingDisabled = this._timeScale.isAllScalingAndScrollingDisabled();
		const isLeftEdgeFixed = this._timeScale.options().fixLeftEdge || isAllScalingAndScrollingDisabled;
		const isRightEdgeFixed = this._timeScale.options().fixRightEdge || isAllScalingAndScrollingDisabled;

		let targetIndex = 0;
		for (const tm of items) {
			if (!(firstBar <= tm.index && tm.index <= lastBar)) {
				continue;
			}

			updateObjectPool(
				this._labels,
				targetIndex,
				(tmValue) => ({
					needAlignCoordinate: false,
					coord: this._timeScale.indexToCoordinate(tmValue.index),
					label: this._timeScale.formatLabel(tmValue),
					weight: tmValue.weight,
				}),
				(item, tmValue) => {
					item.coord = this._timeScale.indexToCoordinate(tmValue.index);
					item.label = this._timeScale.formatLabel(tmValue);
					item.weight = tmValue.weight;
				},
				tm
			);

			const label = this._labels[targetIndex];

			if (spacing > (maxLabelWidth / 2) && !isAllScalingAndScrollingDisabled) {
				// if there is enough space then let's show all tick marks as usual
				label.needAlignCoordinate = false;
			} else {
				// if a user is able to scroll after a tick mark then show it as usual, otherwise the coordinate might be aligned
				// if the index is for the second (last) label or later (earlier) then most likely this label might be displayed without correcting the coordinate
				label.needAlignCoordinate = (isLeftEdgeFixed && tm.index <= earliestIndexOfSecondLabel) || (isRightEdgeFixed && tm.index >= indexOfSecondLastLabel);
			}

			targetIndex++;
		}
		this._labels.length = targetIndex;

		this._timeMarksCache = this._labels;

		return this._labels;
	}

	public invalidate(): void {
		this._timeMarksCache = null;
	}
}
