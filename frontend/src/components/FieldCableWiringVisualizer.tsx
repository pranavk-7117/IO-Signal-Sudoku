import React, { useState, useMemo } from 'react';
import {
  Layers,
  Cable,
  Server,
  X,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  Info,
  Sparkles,
  Zap,
  Activity,
  Cpu,
  ArrowRight,
  MoreVertical,
  Radio,
  Sliders,
  Check
} from 'lucide-react';
import { UtilisationSummary, BaseplateUtilisation, CharmSlot } from '../types';

interface FieldCableWiringVisualizerProps {
  summary: UtilisationSummary;
  selectedCabinetId: string;
  onSelectCabinet: (id: string) => void;
  selectedCiocId: string;
  onSelectCioc: (id: string) => void;
  onSelectSlot?: (slot: {
    cabinet: string;
    cioc: string;
    baseplate: string;
    channel: number;
    tag?: string;
  }) => void;
  onOpenExplainability?: (tag: string) => void;
}

export interface CableRecord {
  cable_id: string;
  pairs: number;
  from_room: string;
  from_equipment: string;
  to_cabinet: string;
  cioc: string;
  assigned_count: number;
  status: 'Fully Assigned' | '1 Unassigned' | 'Partially Assigned';
  color: {
    hex: string;
    bg: string;
    text: string;
  };
  io_counts: Record<string, number | undefined>;
  signals: Array<{
    pair: number;
    tag: string;
    io_type: string;
    slot: string;
    baseplate_num: number;
    channel_num: number;
    status: string;
  }>;
}

// Industrial DeltaV Cabinet SVG Graphic
const CabinetGraphic: React.FC<{ className?: string }> = ({ className = 'w-7 h-10' }) => (
  <svg viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2" width="36" height="52" rx="3" fill="#334155" stroke="#64748B" strokeWidth="2" />
    <rect x="6" y="6" width="28" height="44" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
    <line x1="8" y1="12" x2="32" y2="12" stroke="#475569" strokeWidth="1.5" />
    <line x1="8" y1="20" x2="32" y2="20" stroke="#475569" strokeWidth="1.5" />
    <line x1="8" y1="28" x2="32" y2="28" stroke="#475569" strokeWidth="1.5" />
    <line x1="8" y1="36" x2="32" y2="36" stroke="#475569" strokeWidth="1.5" />
    <line x1="8" y1="44" x2="32" y2="44" stroke="#475569" strokeWidth="1.5" />
    <circle cx="10" cy="9" r="1.5" fill="#10B981" />
    <circle cx="15" cy="9" r="1.5" fill="#38BDF8" />
    <circle cx="20" cy="9" r="1.5" fill="#F59E0B" />
  </svg>
);

// Industrial DeltaV Controller Module SVG Graphic
const ControllerGraphic: React.FC<{ className?: string; isOnline?: boolean }> = ({ className = 'w-7 h-10', isOnline = false }) => (
  <svg viewBox="0 0 36 52" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="2" width="32" height="48" rx="2" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
    <rect x="6" y="6" width="24" height="20" rx="1.5" fill="#334155" />
    <line x1="9" y1="11" x2="27" y2="11" stroke="#64748B" strokeWidth="1.5" />
    <line x1="9" y1="16" x2="27" y2="16" stroke="#64748B" strokeWidth="1.5" />
    <line x1="9" y1="21" x2="27" y2="21" stroke="#64748B" strokeWidth="1.5" />
    <circle cx="10" cy="32" r="2" fill={isOnline ? '#10B981' : '#94A3B8'} />
    <circle cx="18" cy="32" r="2" fill={isOnline ? '#10B981' : '#CBD5E1'} />
    <rect x="8" y="38" width="8" height="8" rx="1" fill="#475569" />
    <rect x="20" y="38" width="8" height="8" rx="1" fill="#475569" />
  </svg>
);

export const FieldCableWiringVisualizer: React.FC<FieldCableWiringVisualizerProps> = ({
  summary,
  selectedCabinetId,
  onSelectCabinet,
  selectedCiocId,
  onSelectCioc,
  onSelectSlot,
  onOpenExplainability
}) => {
  const [viewMode, setViewMode] = useState<'baseplate' | 'cable' | 'train'>('baseplate');
  const [selectedCableId, setSelectedCableId] = useState<string>('500-CE-0013');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

  // Active cabinet
  const cab = useMemo(() => {
    return summary.cabinets.find((c) => c.cabinet_id === selectedCabinetId) || summary.cabinets[0];
  }, [summary, selectedCabinetId]);

  // Active CIOC
  const cioc = useMemo(() => {
    if (!cab) return null;
    return cab.ciocs.find((ci) => ci.cioc_id === selectedCiocId) || cab.ciocs[0];
  }, [cab, selectedCiocId]);

  // Default Cables in CIOC-001 matching the user's uploaded engineering mockup
  const cablesList: CableRecord[] = useMemo(() => {
    return [
      {
        cable_id: '500-CE-0013',
        pairs: 4,
        from_room: 'PIB-30',
        from_equipment: 'TB-101A',
        to_cabinet: 'P30-DCM-32001-01',
        cioc: '001',
        assigned_count: 4,
        status: 'Fully Assigned',
        color: { hex: '#E11D48', bg: 'bg-[#E11D48]', text: 'text-white' },
        io_counts: { DI: 2, AI: 1, DO: 1 },
        signals: [
          { pair: 1, tag: '320-PT-20115', io_type: 'DI', slot: 'CBP-1 / 1', baseplate_num: 1, channel_num: 1, status: 'Assigned' },
          { pair: 2, tag: '320-PT-20116', io_type: 'DI', slot: 'CBP-1 / 2', baseplate_num: 1, channel_num: 2, status: 'Assigned' },
          { pair: 3, tag: '320-FE-1001', io_type: 'AI', slot: 'CBP-1 / 4', baseplate_num: 1, channel_num: 4, status: 'Assigned' },
          { pair: 4, tag: '320-XV-40511', io_type: 'DO', slot: 'CBP-2 / 1', baseplate_num: 2, channel_num: 1, status: 'Assigned' },
        ]
      },
      {
        cable_id: '500-CE-0015',
        pairs: 5,
        from_room: 'PIB-30',
        from_equipment: 'TB-101B',
        to_cabinet: 'P30-DCM-32001-01',
        cioc: '001',
        assigned_count: 5,
        status: 'Fully Assigned',
        color: { hex: '#2563EB', bg: 'bg-[#2563EB]', text: 'text-white' },
        io_counts: { DI: 3, DO: 2 },
        signals: [
          { pair: 1, tag: '320-PT-20117', io_type: 'DI', slot: 'CBP-1 / 3', baseplate_num: 1, channel_num: 3, status: 'Assigned' },
          { pair: 2, tag: '320-XV-40512', io_type: 'DO', slot: 'CBP-2 / 2', baseplate_num: 2, channel_num: 2, status: 'Assigned' },
          { pair: 3, tag: '320-XV-40513', io_type: 'DO', slot: 'CBP-2 / 3', baseplate_num: 2, channel_num: 3, status: 'Assigned' },
          { pair: 4, tag: '320-XV-40514', io_type: 'DO', slot: 'CBP-2 / 4', baseplate_num: 2, channel_num: 4, status: 'Assigned' },
          { pair: 5, tag: '320-XV-40515', io_type: 'DO', slot: 'CBP-2 / 5', baseplate_num: 2, channel_num: 5, status: 'Assigned' },
        ]
      },
      {
        cable_id: '500-CE-LP-0003-B',
        pairs: 13,
        from_room: 'PIB-24',
        from_equipment: 'JB-2401',
        to_cabinet: 'P30-DCM-32001-01',
        cioc: '001',
        assigned_count: 12,
        status: '1 Unassigned',
        color: { hex: '#F97316', bg: 'bg-[#F97316]', text: 'text-white' },
        io_counts: { AI: 8, AO: 4 },
        signals: [
          { pair: 1, tag: '320-FT-20045', io_type: 'AI', slot: 'CBP-3 / 1', baseplate_num: 3, channel_num: 1, status: 'Assigned' },
          { pair: 2, tag: '320-FT-20046', io_type: 'AI', slot: 'CBP-3 / 2', baseplate_num: 3, channel_num: 2, status: 'Assigned' },
          { pair: 3, tag: '320-FT-20047', io_type: 'AI', slot: 'CBP-3 / 3', baseplate_num: 3, channel_num: 3, status: 'Assigned' },
          { pair: 4, tag: '320-PS-3011', io_type: 'DI', slot: 'CBP-3 / 4', baseplate_num: 3, channel_num: 4, status: 'Assigned' },
          { pair: 5, tag: '320-PS-3012', io_type: 'DI', slot: 'CBP-3 / 5', baseplate_num: 3, channel_num: 5, status: 'Assigned' },
          { pair: 6, tag: '320-FCV-7001', io_type: 'AO', slot: 'CBP-5 / 6', baseplate_num: 5, channel_num: 6, status: 'Assigned' },
          { pair: 7, tag: '320-FCV-7002', io_type: 'AO', slot: 'CBP-5 / 7', baseplate_num: 5, channel_num: 7, status: 'Assigned' },
        ]
      },
      {
        cable_id: '500-CE-LP-0003-A',
        pairs: 15,
        from_room: 'PIB-24',
        from_equipment: 'JB-2402',
        to_cabinet: 'P30-DCM-32001-01',
        cioc: '001',
        assigned_count: 15,
        status: 'Fully Assigned',
        color: { hex: '#3B82F6', bg: 'bg-[#3B82F6]', text: 'text-white' },
        io_counts: { DI: 15 },
        signals: [
          { pair: 1, tag: '320-ZS-5001', io_type: 'DI', slot: 'CBP-5 / 1', baseplate_num: 5, channel_num: 1, status: 'Assigned' },
          { pair: 2, tag: '320-ZS-5002', io_type: 'DI', slot: 'CBP-5 / 2', baseplate_num: 5, channel_num: 2, status: 'Assigned' },
          { pair: 3, tag: '320-ZS-5003', io_type: 'DI', slot: 'CBP-5 / 3', baseplate_num: 5, channel_num: 3, status: 'Assigned' },
          { pair: 4, tag: '320-ZS-5004', io_type: 'DI', slot: 'CBP-5 / 4', baseplate_num: 5, channel_num: 4, status: 'Assigned' },
          { pair: 5, tag: '320-ZS-5005', io_type: 'DI', slot: 'CBP-5 / 5', baseplate_num: 5, channel_num: 5, status: 'Assigned' },
        ]
      },
      {
        cable_id: '0502-ICE-0001',
        pairs: 6,
        from_room: 'PIB-30',
        from_equipment: 'RTD-HEAD-1',
        to_cabinet: 'P30-DCM-32001-01',
        cioc: '001',
        assigned_count: 6,
        status: 'Fully Assigned',
        color: { hex: '#10B981', bg: 'bg-[#10B981]', text: 'text-white' },
        io_counts: { RTD: 6 },
        signals: [
          { pair: 1, tag: '320-TE-1001', io_type: 'RTD', slot: 'CBP-4 / 1', baseplate_num: 4, channel_num: 1, status: 'Assigned' },
          { pair: 2, tag: '320-TE-1002', io_type: 'RTD', slot: 'CBP-4 / 2', baseplate_num: 4, channel_num: 2, status: 'Assigned' },
          { pair: 3, tag: '320-TE-1003', io_type: 'RTD', slot: 'CBP-4 / 3', baseplate_num: 4, channel_num: 3, status: 'Assigned' },
          { pair: 4, tag: '320-TE-1004', io_type: 'RTD', slot: 'CBP-4 / 4', baseplate_num: 4, channel_num: 4, status: 'Assigned' },
        ]
      }
    ];
  }, []);

  // Active selected cable record
  const activeCable = useMemo(() => {
    return cablesList.find((c) => c.cable_id === selectedCableId) || cablesList[0];
  }, [cablesList, selectedCableId]);

  // Exact 8 Baseplate Modules definition matching the image
  const baseplateModules = useMemo(() => {
    return [
      {
        id: '001-CBP-1',
        ratio: '10/12',
        slots: [
          { ch: 1, tag: '320-PT-20115', type: 'DI', status: 'Allocated' },
          { ch: 2, tag: '320-PT-20116', type: 'DI', status: 'Allocated' },
          { ch: 3, tag: '320-PT-20117', type: 'DI', status: 'Allocated' },
          { ch: 4, tag: '320-FE-1001', type: 'RTD', status: 'Allocated' },
          { ch: 5, tag: '320-FE-1002', type: 'RTD', status: 'Allocated' },
          { ch: 6, tag: '320-FE-1003', type: 'RTD', status: 'Allocated' },
          { ch: 7, tag: '320-FE-1004', type: 'RTD', status: 'Allocated' },
          { ch: 8, tag: '320-FE-1005', type: 'RTD', status: 'Allocated' },
          { ch: 9, tag: '320-LT-3001', type: 'AI', status: 'Allocated' },
          { ch: 10, tag: '320-LT-3002', type: 'AI', status: 'Allocated' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-2',
        ratio: '9/12',
        slots: [
          { ch: 1, tag: '320-XV-40511', type: 'DO', status: 'Allocated' },
          { ch: 2, tag: '320-XV-40512', type: 'DO', status: 'Allocated' },
          { ch: 3, tag: '320-XV-40513', type: 'DO', status: 'Allocated' },
          { ch: 4, tag: '320-XV-40514', type: 'DO', status: 'Allocated' },
          { ch: 5, tag: '320-XV-40515', type: 'DO', status: 'Allocated' },
          { ch: 6, tag: '320-TI-5001', type: 'AO', status: 'Allocated' },
          { ch: 7, tag: '320-TI-5002', type: 'AO', status: 'Allocated' },
          { ch: 8, tag: '320-TI-5003', type: 'AO', status: 'Allocated' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-3',
        ratio: '9/12',
        slots: [
          { ch: 1, tag: '320-FT-20045', type: 'AI', status: 'Allocated' },
          { ch: 2, tag: '320-FT-20046', type: 'AI', status: 'Allocated' },
          { ch: 3, tag: '320-FT-20047', type: 'AI', status: 'Allocated' },
          { ch: 4, tag: '320-PS-3011', type: 'DI', status: 'Allocated' },
          { ch: 5, tag: '320-PS-3012', type: 'DI', status: 'Allocated' },
          { ch: 6, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 7, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 8, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-4',
        ratio: '9/12',
        slots: [
          { ch: 1, tag: '320-TE-1001', type: 'RTD', status: 'Allocated' },
          { ch: 2, tag: '320-TE-1002', type: 'RTD', status: 'Allocated' },
          { ch: 3, tag: '320-TE-1003', type: 'RTD', status: 'Allocated' },
          { ch: 4, tag: '320-TE-1004', type: 'RTD', status: 'Allocated' },
          { ch: 5, tag: '320-PIT-4001', type: 'AI', status: 'Allocated' },
          { ch: 6, tag: '320-PIT-4002', type: 'AI', status: 'Allocated' },
          { ch: 7, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 8, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-5',
        ratio: '7/12',
        slots: [
          { ch: 1, tag: '320-ZS-5001', type: 'DI', status: 'Allocated' },
          { ch: 2, tag: '320-ZS-5002', type: 'DI', status: 'Allocated' },
          { ch: 3, tag: '320-ZS-5003', type: 'DI', status: 'Allocated' },
          { ch: 4, tag: '320-ZS-5004', type: 'DI', status: 'Allocated' },
          { ch: 5, tag: '320-ZS-5005', type: 'DI', status: 'Allocated' },
          { ch: 6, tag: '320-FCV-7001', type: 'AO', status: 'Allocated' },
          { ch: 7, tag: '320-FCV-7002', type: 'AO', status: 'Allocated' },
          { ch: 8, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-6',
        ratio: '6/12',
        slots: [
          { ch: 1, tag: '320-PT-6001', type: 'DI', status: 'Allocated' },
          { ch: 2, tag: '320-PT-6002', type: 'DI', status: 'Allocated' },
          { ch: 3, tag: '320-PT-6003', type: 'DI', status: 'Allocated' },
          { ch: 4, tag: '320-PT-6004', type: 'DI', status: 'Allocated' },
          { ch: 5, tag: '320-XY-40521', type: 'DO', status: 'Allocated' },
          { ch: 6, tag: '320-XY-40522', type: 'DO', status: 'Allocated' },
          { ch: 7, tag: '320-XY-40523', type: 'DO', status: 'Allocated' },
          { ch: 8, tag: '320-XY-40524', type: 'DO', status: 'Allocated' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-7',
        ratio: '6/12',
        slots: [
          { ch: 1, tag: 'P13-CAB-EJA-01', type: 'INT', status: 'Internal' },
          { ch: 2, tag: 'P13-CAB-EJA-02', type: 'INT', status: 'Internal' },
          { ch: 3, tag: '320-LT-3005', type: 'AI', status: 'Allocated' },
          { ch: 4, tag: '320-LT-3006', type: 'AI', status: 'Allocated' },
          { ch: 5, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 6, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 7, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 8, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      },
      {
        id: '001-CBP-8',
        ratio: '1/12',
        slots: [
          { ch: 1, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 2, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 3, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 4, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 5, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 6, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 7, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 8, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 9, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 10, tag: '-', type: 'EMPTY', status: 'Empty' },
          { ch: 11, tag: 'SPR', type: 'SPARE', status: 'Spare' },
          { ch: 12, tag: 'SPR', type: 'SPARE', status: 'Spare' },
        ]
      }
    ];
  }, []);

  // Helper to get slot background and text color based on IO Type
  const getSlotStyle = (type: string, isCableSelected: boolean = false) => {
    switch (type) {
      case 'DI':
        return 'bg-[#EF4444] text-white font-bold border-transparent';
      case 'DO':
        return 'bg-[#F97316] text-white font-bold border-transparent';
      case 'AI':
        return 'bg-[#3B82F6] text-white font-bold border-transparent';
      case 'AO':
        return 'bg-[#8B5CF6] text-white font-bold border-transparent';
      case 'RTD':
        return 'bg-[#10B981] text-white font-bold border-transparent';
      case 'INT':
        return 'bg-[#BE123C] text-white font-bold border-transparent';
      case 'SPARE':
        return 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold text-center';
      default:
        return 'bg-white/90 text-slate-300 border border-slate-200/60 font-mono';
    }
  };

  const getBadgeStyle = (ioType: string) => {
    switch (ioType) {
      case 'DI': return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'DO': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'AI': return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'AO': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RTD': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. TOP BAR / FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Dropdowns Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* System Cabinet */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              System Cabinet
            </label>
            <div className="relative mt-0.5">
              <select
                value="P30-DCS-32001-01"
                onChange={() => {}}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1 pr-7 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none"
              >
                <option value="P30-DCS-32001-01">P30-DCS-32001-01</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-2 pointer-events-none" />
            </div>
            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
              Controller: P30DPK320101
            </span>
          </div>

          {/* Marshalling Cabinet */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Marshalling Cabinet
            </label>
            <div className="relative mt-0.5">
              <select
                value={cab?.cabinet_id || 'P30-DCM-32001-01'}
                onChange={(e) => onSelectCabinet(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1 pr-7 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none"
              >
                {summary.cabinets.map((c) => (
                  <option key={c.cabinet_id} value={c.cabinet_id}>
                    {c.cabinet_id.startsWith('DCS') ? `P30-DCM-32001-0${c.cabinet_id.replace('DCS-0', '')} (Front)` : `${c.cabinet_id} (Front)`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* CIOC / CSLS */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              CIOC / CSLS
            </label>
            <div className="relative mt-0.5">
              <select
                value={cioc?.cioc_id || 'CIOC-01'}
                onChange={(e) => onSelectCioc(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1 pr-7 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none font-mono"
              >
                {cab?.ciocs.map((ci) => (
                  <option key={ci.cioc_id} value={ci.cioc_id}>
                    {ci.cioc_id.replace('CIOC-', '').replace('CIOC', '').padStart(3, '0')}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-2 pointer-events-none" />
            </div>
            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
              Baseplates: 8 | Signals: 72/96
            </span>
          </div>

          {/* View Mode */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              View Mode
            </label>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('baseplate')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'baseplate' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Baseplate
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cable')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'cable' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cable
              </button>
              <button
                type="button"
                onClick={() => setViewMode('train')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'train' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Train
              </button>
            </div>
          </div>
        </div>

        {/* IO Type Colors & Legend (Integrated directly in top-right) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 space-y-1">
          <div className="flex items-center space-x-3 text-[10px] font-bold">
            <span className="text-slate-400 font-semibold mr-1">IO Type Colors</span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
              <span className="text-slate-700">AI</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
              <span className="text-slate-700">AO</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
              <span className="text-slate-700">DI</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]"></span>
              <span className="text-slate-700">DO</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
              <span className="text-slate-700">RTD</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]"></span>
              <span className="text-slate-700">Special</span>
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center space-x-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FEF3C7] border border-[#FDE68A]"></span>
              <span>Wired Spare</span>
            </span>
            <span className="flex items-center space-x-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300"></span>
              <span>Empty</span>
            </span>
            <span className="flex items-center space-x-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#BE123C]"></span>
              <span>Diagnostic/Internal</span>
            </span>
            <span className="flex items-center space-x-1 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#34D399]"></span>
              <span>Reserved</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN 3-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
        {/* LEFT COLUMN: CABINET HIERARCHY */}
        <div className="xl:col-span-2 bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
            CABINET HIERARCHY
          </div>

          {/* System Cabinet Master Card */}
          <div className="bg-[#1E293B] text-white rounded-xl p-2.5 flex items-center space-x-2.5 shadow-sm border border-slate-700">
            <CabinetGraphic className="w-8 h-10 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold truncate">System Cabinet</div>
              <div className="text-[10px] font-mono text-slate-400 truncate">P30-DCS-32001-01</div>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[9px] text-emerald-400 font-bold">Online</span>
              </div>
            </div>
          </div>

          {/* Controller Nodes connected by tree lines */}
          <div className="space-y-2 relative pl-3 border-l-2 border-slate-300 ml-3">
            {/* Controller 01 */}
            <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center space-x-2.5 shadow-2xs relative">
              <ControllerGraphic isOnline={true} className="w-7 h-9 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">Controller 01</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">P30DPK320101</div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] text-emerald-600 font-bold">Online</span>
                </div>
              </div>
            </div>

            {/* Controller 02 */}
            <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center space-x-2.5 shadow-2xs">
              <ControllerGraphic isOnline={false} className="w-7 h-9 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">Controller 02</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">P30DPK320102</div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span className="text-[9px] text-slate-500 font-bold">Standby</span>
                </div>
              </div>
            </div>

            {/* Controller 03 */}
            <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center space-x-2.5 shadow-2xs">
              <ControllerGraphic isOnline={false} className="w-7 h-9 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">Controller 03</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">P30DPK320103</div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span className="text-[9px] text-slate-500 font-bold">Standby</span>
                </div>
              </div>
            </div>

            {/* Controller 04 */}
            <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center space-x-2.5 shadow-2xs">
              <ControllerGraphic isOnline={false} className="w-7 h-9 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">Controller 04</div>
                <div className="text-[10px] font-mono text-slate-500 truncate">P30DPK320104</div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span className="text-[9px] text-slate-500 font-bold">Standby</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: CIOC-001 RACK + CABLE TABLE & PREVIEW */}
        <div className="xl:col-span-7 space-y-3.5">
          {/* TOP SECTION: CIOC-001 CARRIER RACK */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
            {/* Carrier Rack Header Bar */}
            <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-black text-slate-900 text-sm">CIOC-001</span>
                <span className="text-slate-600 font-medium">Marshalling Cabinet: P30-DCM-32001-01 (Front)</span>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center space-x-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Layers className="w-3 h-3 text-blue-600" />
                  <span>8 Baseplates</span>
                </span>
                <span className="flex items-center space-x-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Cpu className="w-3 h-3 text-blue-600" />
                  <span>96 Channels</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>72 Assigned</span>
                </span>
                <span className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>12 Spares</span>
                </span>
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-mono">
                  12.5% Spare Margin
                </span>

                {/* Train Selector */}
                <div className="flex items-center bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md cursor-pointer">
                  <span>Train: A (Primary)</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </div>

                {/* CIOC Health */}
                <span className="flex items-center space-x-1 text-emerald-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>CIOC Health: Online</span>
                </span>
              </div>
            </div>

            {/* 8 Baseplate Industrial Modules */}
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start space-x-2.5 min-w-[760px]">
                {baseplateModules.map((bp) => (
                  <div
                    key={bp.id}
                    className="flex-1 min-w-[95px] max-w-[110px] bg-slate-100/90 border border-slate-300 rounded-xl overflow-hidden shadow-2xs"
                  >
                    {/* Metallic Top Bar / Handle */}
                    <div className="bg-[#1E293B] text-white p-1 text-center font-mono">
                      <div className="text-[10px] font-bold">{bp.id}</div>
                      <div className="text-[9px] text-slate-300">{bp.ratio}</div>
                    </div>

                    {/* 12 Channels */}
                    <div className="p-1 space-y-1 bg-slate-200/60">
                      {bp.slots.map((s) => {
                        const slotStyle = getSlotStyle(s.type);
                        const isAlloc = s.type !== 'EMPTY' && s.type !== 'SPARE';

                        return (
                          <div
                            key={s.ch}
                            onClick={() => {
                              if (isAlloc && onOpenExplainability) {
                                onOpenExplainability(s.tag);
                              } else if (onSelectSlot) {
                                onSelectSlot({
                                  cabinet: 'P30-DCM-32001-01',
                                  cioc: 'CIOC-01',
                                  baseplate: bp.id,
                                  channel: s.ch,
                                  tag: s.tag !== '-' ? s.tag : undefined
                                });
                              }
                            }}
                            className={`h-5.5 rounded px-1 flex items-center justify-between text-[9px] font-mono cursor-pointer transition-transform hover:scale-[1.02] shadow-2xs ${slotStyle}`}
                            title={`Ch ${s.ch}: ${s.tag} (${s.type})`}
                          >
                            <span className="opacity-90 font-bold shrink-0">{s.ch}</span>
                            <span className="truncate mx-1 tracking-tight">{s.tag}</span>
                            {isAlloc && (
                              <span className="text-[8px] opacity-90 uppercase font-sans shrink-0">
                                {s.type}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom metallic footing */}
                    <div className="h-1.5 bg-slate-300 border-t border-slate-400"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: CABLES IN CIOC-001 + CABLE ROUTING PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Center-Bottom Left: Cables in CIOC-001 (13) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">
                  CABLES IN CIOC-001 (13)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="text-[10px] text-slate-400 uppercase border-b border-slate-100 font-sans">
                    <tr>
                      <th className="py-1 px-1.5">Cable No.</th>
                      <th className="py-1 px-1">Pairs</th>
                      <th className="py-1 px-1">From Room</th>
                      <th className="py-1 px-1">To Cabinet</th>
                      <th className="py-1 px-1">Assigned</th>
                      <th className="py-1 px-1 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {cablesList.map((c) => {
                      const isSelected = c.cable_id === activeCable.cable_id;
                      return (
                        <tr
                          key={c.cable_id}
                          onClick={() => setSelectedCableId(c.cable_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 font-bold text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <td className="py-1.5 px-1.5 flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${c.color.bg}`}></span>
                            <span>{c.cable_id}</span>
                          </td>
                          <td className="py-1.5 px-1">{c.pairs}</td>
                          <td className="py-1.5 px-1 text-slate-500">{c.from_room}</td>
                          <td className="py-1.5 px-1 text-slate-500 truncate max-w-[90px]">{c.to_cabinet}</td>
                          <td className="py-1.5 px-1 font-bold">{c.assigned_count} / {c.pairs}</td>
                          <td className="py-1.5 px-1 text-right">
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9px] font-sans font-bold ${
                                c.status === 'Fully Assigned'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Center-Bottom Right: Cable Routing Preview Card */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">
                  CABLE ROUTING PREVIEW
                </span>
                <span className="text-[10px] font-mono text-blue-700 font-bold">
                  {activeCable.cable_id} ({activeCable.pairs}P)
                </span>
              </div>

              {/* End-to-End Visual Ribbon */}
              <div className="flex items-center justify-between gap-2 pt-1 font-mono text-xs">
                {/* Field Instruments */}
                <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[70px]">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 mb-1">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-800 font-sans">Field</span>
                  <span className="text-[8px] text-slate-400">Instruments PIB-30</span>
                </div>

                {/* Flowing multi-pair wire ribbon */}
                <div className="flex-1 flex flex-col items-center px-1">
                  <span className="text-[9px] font-bold text-slate-700 font-sans mb-1">
                    {activeCable.cable_id} ({activeCable.pairs}P)
                  </span>
                  <svg viewBox="0 0 100 24" className="w-full h-5 overflow-visible">
                    <path d="M 0 4 Q 50 -2 100 4" stroke="#EF4444" strokeWidth="2" fill="none" />
                    <path d="M 0 10 Q 50 4 100 10" stroke="#3B82F6" strokeWidth="2" fill="none" />
                    <path d="M 0 16 Q 50 10 100 16" stroke="#F97316" strokeWidth="2" fill="none" />
                    <path d="M 0 22 Q 50 16 100 22" stroke="#10B981" strokeWidth="2" fill="none" />
                  </svg>
                </div>

                {/* Marshalling Cabinet */}
                <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[75px]">
                  <CabinetGraphic className="w-6 h-8 mb-1" />
                  <span className="text-[9px] font-bold text-slate-800 font-sans">Marshalling</span>
                  <span className="text-[8px] text-slate-400">CIOC-001</span>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                {/* Baseplate */}
                <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[55px]">
                  <span className="text-[9px] font-bold text-slate-700">001-CBP-1</span>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center space-x-1 text-[8px]">
                      <span>1</span>
                      <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    </div>
                    <div className="flex items-center space-x-1 text-[8px]">
                      <span>3</span>
                      <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                    </div>
                    <div className="flex items-center space-x-1 text-[8px]">
                      <span>4</span>
                      <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
                    </div>
                  </div>
                </div>

                {/* CHARMs Modules Cards */}
                <div className="space-y-1 min-w-[85px] font-sans">
                  <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    SE4301T02 (DI)
                  </div>
                  <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                    SE4303T01 (AI)
                  </div>
                  <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                    SE4302T02 (DO)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CABLE DETAILS & SIGNALS IN THIS CABLE */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              CABLE DETAILS
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cable Header Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${activeCable.color.bg}`}></span>
              <span className="font-mono font-bold text-xs text-slate-900">
                {activeCable.cable_id} ({activeCable.pairs}P)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
              {activeCable.status}
            </span>
          </div>

          {/* Key-Value Properties */}
          <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-sans">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Cable Type</span>
              <span className="font-semibold text-slate-800 text-[11px]">Field Cable Multi-Pair</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Total Pairs</span>
              <span className="font-mono font-bold text-slate-800">{activeCable.pairs}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">Assigned Pairs</span>
              <span className="font-mono font-bold text-slate-800">{activeCable.assigned_count} / {activeCable.pairs}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">From Room</span>
              <span className="font-mono font-semibold text-slate-800">{activeCable.from_room}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">From Equipment</span>
              <span className="font-mono font-semibold text-slate-800">{activeCable.from_equipment}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">To Cabinet</span>
              <span className="font-mono font-semibold text-slate-800 truncate block">{activeCable.to_cabinet}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">CIOC</span>
              <span className="font-mono font-semibold text-slate-800">{activeCable.cioc}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">IO Types</span>
              <div className="flex items-center space-x-1 mt-0.5">
                {Object.entries(activeCable.io_counts)
                  .filter(([_, count]) => count && count > 0)
                  .map(([type, count]) => {
                    const badge = getBadgeStyle(type);
                    return (
                      <span
                        key={type}
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge}`}
                      >
                        {type} ({count})
                      </span>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* SIGNALS IN THIS CABLE (4) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                SIGNALS IN THIS CABLE ({activeCable.signals.length})
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 text-slate-600 font-mono text-[9px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2">Pair</th>
                    <th className="py-1.5 px-1.5">Tag Number</th>
                    <th className="py-1.5 px-1.5">IO Type</th>
                    <th className="py-1.5 px-1.5">Slot</th>
                    <th className="py-1.5 px-1.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                  {activeCable.signals.map((s) => {
                    const badge = getBadgeStyle(s.io_type);
                    return (
                      <tr
                        key={s.pair}
                        onClick={() => onOpenExplainability && onOpenExplainability(s.tag)}
                        className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                      >
                        <td className="py-1.5 px-2 font-bold text-slate-800">{s.pair}</td>
                        <td className="py-1.5 px-1.5 font-bold text-blue-700 font-sans">{s.tag}</td>
                        <td className="py-1.5 px-1.5">
                          <span className={`px-1 py-0.2 rounded text-[8px] font-bold font-sans border ${badge}`}>
                            {s.io_type}
                          </span>
                        </td>
                        <td className="py-1.5 px-1.5 text-slate-600 text-[9px]">{s.slot}</td>
                        <td className="py-1.5 px-1.5 text-right font-sans">
                          <span className="text-emerald-700 font-bold text-[9px]">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
