import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  onClick
}) => {
  const colorMap = {
    blue: 'border-l-blue-600 text-blue-600 bg-blue-50',
    emerald: 'border-l-emerald-600 text-emerald-600 bg-emerald-50',
    amber: 'border-l-amber-600 text-amber-600 bg-amber-50',
    rose: 'border-l-rose-600 text-rose-600 bg-rose-50',
    slate: 'border-l-slate-600 text-slate-600 bg-slate-50',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-5 border border-slate-200 border-l-4 ${colorMap[color].split(' ')[0]} shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className={`p-2 rounded-md ${colorMap[color].split(' ').slice(1).join(' ')}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
        {trend && <span className="text-xs font-medium text-slate-500">{trend}</span>}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>}
    </div>
  );
};
