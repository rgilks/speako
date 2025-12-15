import { TooltipState } from '../../hooks/useAudioPlayback';

export function AudioVisualizerTooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip.visible) return null;

  return (
    <div
      className="av-tooltip"
      style={{
        left: `${tooltip.x + 12}px`,
        top: `${tooltip.y - 40}px`,
      }}
    >
      <div className="av-tooltip-word">{tooltip.word}</div>
      <div className="av-tooltip-duration">{(tooltip.duration * 1000).toFixed(0)}ms</div>
    </div>
  );
}
