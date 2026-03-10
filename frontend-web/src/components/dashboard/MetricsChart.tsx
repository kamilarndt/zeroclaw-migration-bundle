import React, { useId } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsChartProps {
  title: string;
  currentValue: number;
  history: number[];
  unit?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: string;
  trend?: number;
  className?: string;
}

const MetricsChart = React.memo(({ 
  title, 
  currentValue, 
  history, 
  unit = '', 
  icon: Icon, 
  color = '#00ff9d',
  trend,
  className = ''
}: MetricsChartProps) => {
  const gradientId = useId();
  const formatValue = (val: number): string => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
  };

  // Normalize values to 0-1 range for SVG calculation
  const maxValue = Math.max(...history, currentValue) || 1;
  const normalizedHistory = history.map(v => v / maxValue);
  const normalizedCurrentValue = currentValue / maxValue;

  // Generate SVG path for the history line
  const generatePath = () => {
    if (normalizedHistory.length === 0) return '';
    
    const points = normalizedHistory.map((value, index) => {
      const x = (index / (normalizedHistory.length - 1)) * 80;
      const y = 20 - (value * 20); // SVG coordinates are inverted
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    });
    
    return points.join(' ');
  };

  return (
    <div className={`bg-black/50 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all hover:scale-105 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {formatValue(currentValue)}{unit && <span className="text-base ml-1">{unit}</span>}
          </p>
        </div>
        <Icon size={24} className="text-white/50" />
      </div>

      {/* Chart */}
      <div className="h-16 flex items-end justify-between mb-3">
        <svg width="100%" height="20" viewBox="0 0 80 20" className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* History line */}
          {history.length > 0 && (
            <path
              d={generatePath()}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          
          {/* Current value dot */}
          <circle
            cx={normalizedHistory.length > 0 ? "80" : "0"}
            cy={20 - (normalizedCurrentValue * 20)}
            r="3"
            fill={color}
          />
        </svg>
      </div>

      {trend !== undefined && (
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {trend >= 0 ? (
              <TrendingUp size={16} className="text-green-400 mr-1" />
            ) : (
              <TrendingDown size={16} className="text-red-400 mr-1" />
            )}
            <span className={`text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {Math.abs(trend)}% vs last period
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Peak: {formatValue(maxValue)}{unit}
          </span>
        </div>
      )}
    </div>
  );
});

MetricsChart.displayName = 'MetricsChart';

export default MetricsChart;