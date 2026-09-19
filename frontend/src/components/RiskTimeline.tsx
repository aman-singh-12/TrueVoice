/**
 * TrueVoice Real-Time Risk Progression Timeline.
 * Bounded SVG graph rendering sliding window risk score history (last 60 evaluation hops).
 */

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
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Max points displayed: 60
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
    <div className="risk-timeline-card" data-testid="risk-timeline">
      <div className="card-header">
        <h3 className="card-title">REAL-TIME RISK PROGRESSION</h3>
        <div className="timeline-legend">
          <span className="legend-item risk-legend">
            <span className="legend-line risk-line-sample" /> Composite Risk
          </span>
          <span className="legend-item df-legend">
            <span className="legend-line df-line-sample" /> Deepfake Prob
          </span>
        </div>
      </div>

      <div className="timeline-svg-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="timeline-svg">
          <defs>
            <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Threshold Lines */}
          <line
            x1={padding.left}
            y1={yCrit}
            x2={width - padding.right}
            y2={yCrit}
            stroke="#ef444444"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text x={padding.left - 6} y={yCrit + 4} textAnchor="end" className="axis-label crit-label">
            80
          </text>

          <line
            x1={padding.left}
            y1={yHigh}
            x2={width - padding.right}
            y2={yHigh}
            stroke="#f9731644"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text x={padding.left - 6} y={yHigh + 4} textAnchor="end" className="axis-label high-label">
            60
          </text>

          <line
            x1={padding.left}
            y1={yMod}
            x2={width - padding.right}
            y2={yMod}
            stroke="#f59e0b44"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <text x={padding.left - 6} y={yMod + 4} textAnchor="end" className="axis-label mod-label">
            30
          </text>

          {/* Bottom Baseline */}
          <line
            x1={padding.left}
            y1={getY(0)}
            x2={width - padding.right}
            y2={getY(0)}
            stroke="#374151"
            strokeWidth="1"
          />
          <text x={padding.left - 6} y={getY(0) + 4} textAnchor="end" className="axis-label">
            0
          </text>

          {/* Plotted Paths */}
          {active && data.length > 0 && (
            <>
              {/* Area Gradient */}
              <path d={riskAreaPath} fill="url(#riskAreaGrad)" />

              {/* Deepfake Probability Line (Dotted Purple) */}
              <path
                d={deepfakePath}
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
              />

              {/* Composite Risk Line (Solid Cyan/Red) */}
              <path
                d={riskPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Latest Point Pulse */}
              {data.length > 0 && (
                <circle
                  cx={getX(maxPoints - 1, maxPoints)}
                  cy={getY(data[data.length - 1].risk_score)}
                  r="4"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="pulse-dot"
                />
              )}
            </>
          )}

          {!active && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              className="chart-empty-text"
              fill="#4b5563"
            >
              AWAITING AUDIO STREAM...
            </text>
          )}
        </svg>
      </div>

      <div className="timeline-footer">
        <span className="timeline-range-label">T - 30s</span>
        <span className="timeline-samples-label">
          {data.length > 0 ? `Seq #${data[data.length - 1].sequence_id} (${data.length} evaluations)` : 'No active stream'}
        </span>
        <span className="timeline-range-label">LIVE (Now)</span>
      </div>
    </div>
  );
};
