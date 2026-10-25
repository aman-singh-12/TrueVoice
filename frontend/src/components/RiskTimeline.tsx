import React from 'react';

export interface TimelinePoint {
  sequence_id: number;
  timestamp: string;
  risk_score: number;
  synthetic_prob: number;
}

export interface RiskTimelineProps {
  history: TimelinePoint[];
  active: boolean;
}

export const RiskTimeline: React.FC<RiskTimelineProps> = ({ history, active }) => {
  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 36 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Max points displayed: 60 (sliding window)
  const maxPoints = 60;
  const data = history.slice(-maxPoints);

  // Scale Y: 0 to 100
  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return padding.top + plotHeight - (clamped / 100) * plotHeight;
  };

  // Scale X: index across 0..maxPoints-1
  const getX = (idx: number, total: number) => {
    if (total <= 1) return padding.left;
    return padding.left + (idx / (maxPoints - 1)) * plotWidth;
  };

  // Build SVG path for risk_score
  let riskPath = '';
  let riskAreaPath = '';
  let deepfakePath = '';

  if (data.length > 0) {
    const offset = maxPoints - data.length;
    data.forEach((p, i) => {
      const x = getX(offset + i, maxPoints);
      const yRisk = getY(p.risk_score);
      const yDf = getY(p.synthetic_prob * 100);

      if (i === 0) {
        riskPath += `M ${x} ${yRisk}`;
        deepfakePath += `M ${x} ${yDf}`;
        riskAreaPath += `M ${x} ${getY(0)} L ${x} ${yRisk}`;
      } else {
        riskPath += ` L ${x} ${yRisk}`;
        deepfakePath += ` L ${x} ${yDf}`;
        riskAreaPath += ` L ${x} ${yRisk}`;
      }
    });

    const lastX = getX(maxPoints - 1, maxPoints);
    const firstX = getX(maxPoints - data.length, maxPoints);
    riskAreaPath += ` L ${lastX} ${getY(0)} L ${firstX} ${getY(0)} Z`;
  }

  // Threshold Y positions
  const yCrit = getY(80);
  const yHigh = getY(60);
  const yMod = getY(30);

  return (
    <div className="w-full flex flex-col gap-2" data-testid="risk-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-mono text-slate-400">Sliding Window (60 Hops · ~30s)</span>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
            <span className="text-slate-300">Composite Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-400" />
            <span className="text-slate-300">Deepfake Prob</span>
          </div>
        </div>
      </div>

      <div className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-inner">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="socRiskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid Threshold Lines */}
          <line
            x1={padding.left}
            y1={yCrit}
            x2={width - padding.right}
            y2={yCrit}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          <text x={padding.left - 6} y={yCrit + 3} textAnchor="end" className="fill-rose-400 font-mono text-[9px]">
            80
          </text>

          <line
            x1={padding.left}
            y1={yHigh}
            x2={width - padding.right}
            y2={yHigh}
            stroke="#f97316"
            strokeDasharray="3 3"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          <text x={padding.left - 6} y={yHigh + 3} textAnchor="end" className="fill-orange-400 font-mono text-[9px]">
            60
          </text>

          <line
            x1={padding.left}
            y1={yMod}
            x2={width - padding.right}
            y2={yMod}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            strokeWidth="1"
            strokeOpacity="0.4"
          />
          <text x={padding.left - 6} y={yMod + 3} textAnchor="end" className="fill-amber-400 font-mono text-[9px]">
            30
          </text>

          {/* Baseline */}
          <line
            x1={padding.left}
            y1={getY(0)}
            x2={width - padding.right}
            y2={getY(0)}
            stroke="#334155"
            strokeWidth="1"
          />
          <text x={padding.left - 6} y={getY(0) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[9px]">
            0
          </text>

          {/* Plotted Paths */}
          {active && data.length > 0 && (
            <>
              {/* Area Gradient */}
              <path d={riskAreaPath} fill="url(#socRiskGrad)" />

              {/* Deepfake Probability Line */}
              <path
                d={deepfakePath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.85"
              />

              {/* Composite Risk Line */}
              <path
                d={riskPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.7))' }}
              />

              {/* Latest Point Pulse */}
              {data.length > 0 && (
                <circle
                  cx={getX(maxPoints - 1, maxPoints)}
                  cy={getY(data[data.length - 1].risk_score)}
                  r="4.5"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              )}
            </>
          )}

          {!active && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-xs tracking-wider uppercase"
            >
              Standby · Awaiting live audio stream
            </text>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 px-1">
        <span>T - 30s</span>
        <span>
          {data.length > 0
            ? `Hop #${data[data.length - 1].sequence_id} (${data.length} evals)`
            : 'No active stream'}
        </span>
        <span className="text-emerald-400 font-bold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          LIVE (Now)
        </span>
      </div>
    </div>
  );
};
