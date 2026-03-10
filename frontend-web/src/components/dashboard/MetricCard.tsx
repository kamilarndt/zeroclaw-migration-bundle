import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: number;
  onClick?: () => void;
  color?: string;
  dataTestId?: string;
}

const MetricCard = React.memo(({
  title,
  value,
  unit = '',
  icon: Icon,
  trend,
  color = '#00ff9d',
  dataTestId
}: MetricCardProps) => {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div
      className="bg-black/50 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all hover:scale-105 cursor-pointer"
      style={{ cursor: 'pointer' }}
      data-testid={dataTestId}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {formatValue(value)}{unit && <span className="text-base ml-1">{unit}</span>}
          </p>
        </div>
        <Icon size={24} className="text-white/50" />
      </div>
      {trend !== undefined && (
        <div className="flex items-center mt-3">
          {trend >= 0 ? (
            <TrendingUp size={16} className="text-green-400 mr-1" />
          ) : (
            <TrendingDown size={16} className="text-red-400 mr-1" />
          )}
          <span className={`text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {Math.abs(trend)}% vs last period
          </span>
        </div>
      )}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

export default MetricCard;
