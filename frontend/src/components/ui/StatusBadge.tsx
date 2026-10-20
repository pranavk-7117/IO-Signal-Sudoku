import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Info } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = (status || '').toUpperCase().trim();

  let bg = 'bg-slate-100 text-slate-700 border-slate-300';
  let icon = <Info className="w-3.5 h-3.5 mr-1" />;

  if (norm === 'ALLOCATED' || norm === 'RESOLVED' || norm === 'CLOSED' || norm === 'PRESERVED' || norm === 'VALID') {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />;
  } else if (norm === 'NEEDS REVIEW' || norm === 'WARNING' || norm === 'IN REVIEW' || norm === 'MOVED' || norm === 'MODIFIED') {
    bg = 'bg-amber-50 text-amber-800 border-amber-300';
    icon = <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />;
  } else if (norm === 'BLOCKED' || norm === 'ERROR' || norm === 'DELETED') {
    bg = 'bg-rose-50 text-rose-700 border-rose-300';
    icon = <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />;
  } else if (norm === 'OPEN' || norm === 'PENDING' || norm === 'ADDED' || norm === 'NEW') {
    bg = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />;
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center font-medium border rounded-full ${px} ${bg}`}>
      {icon}
      {status}
    </span>
  );
};
