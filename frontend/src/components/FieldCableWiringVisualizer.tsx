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
  ArrowRight
} from 'lucide-react';
import { UtilisationSummary, CIOCUtilisation, BaseplateUtilisation, CharmSlot } from '../types';

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

export interface CableGrouping {
  cable_id: string;
  spec: string;
  total_pairs: number;
  assigned_pairs: number;
  cable_from: string;
  cable_to: string;
  io_types: { [type: string]: number };
  color: {
    hex: string;
    bg: string;
    border: string;
    text: string;
    badge: string;
  };
  slots: Array<{
    baseplate: string;
    baseplate_num: number;
    channel: number;
    pair_number: number;
    tag: string;
    signal_type: string;
  }>;
}

const CABLE_PALETTE: { [key: string]: { hex: string; bg: string; border: string; text: string; badge: string } } = {
  '500-CE-0015': { hex: '#E11D48', bg: 'bg-[#E11D48]', border: 'border-rose-600', text: 'text-white', badge: 'bg-[#E11D48]' },
  '320-CE-0015': { hex: '#E11D48', bg: 'bg-[#E11D48]', border: 'border-rose-600', text: 'text-white', badge: 'bg-[#E11D48]' },
  '500-CE-0013': { hex: '#0D9488', bg: 'bg-[#0D9488]', border: 'border-teal-600', text: 'text-white', badge: 'bg-[#0D9488]' },
  '320-CE-0013': { hex: '#0D9488', bg: 'bg-[#0D9488]', border: 'border-teal-600', text: 'text-white', badge: 'bg-[#0D9488]' },
  '0502-ICE-0001': { hex: '#F59E0B', bg: 'bg-[#F59E0B]', border: 'border-amber-500', text: 'text-slate-950', badge: 'bg-[#F59E0B]' },
  'P30-ICE-0001': { hex: '#F59E0B', bg: 'bg-[#F59E0B]', border: 'border-amber-500', text: 'text-slate-950', badge: 'bg-[#F59E0B]' },
  '500-CE-LP-0003-B': { hex: '#2563EB', bg: 'bg-[#2563EB]', border: 'border-blue-600', text: 'text-white', badge: 'bg-[#2563EB]' },
  '320-CE-LP-0003-B': { hex: '#2563EB', bg: 'bg-[#2563EB]', border: 'border-blue-600', text: 'text-white', badge: 'bg-[#2563EB]' },
  '500-CE-LP-0003-A': { hex: '#9333EA', bg: 'bg-[#9333EA]', border: 'border-purple-600', text: 'text-white', badge: 'bg-[#9333EA]' },
  '320-CE-LP-0003-A': { hex: '#9333EA', bg: 'bg-[#9333EA]', border: 'border-purple-600', text: 'text-white', badge: 'bg-[#9333EA]' },
  '320-CE-0001': { hex: '#0284C7', bg: 'bg-[#0284C7]', border: 'border-sky-600', text: 'text-white', badge: 'bg-[#0284C7]' },
  '320-CE-0004': { hex: '#059669', bg: 'bg-[#059669]', border: 'border-emerald-600', text: 'text-white', badge: 'bg-[#059669]' },
};

const FALLBACK_PALETTE = [
  { hex: '#E11D48', bg: 'bg-[#E11D48]', border: 'border-rose-600', text: 'text-white', badge: 'bg-[#E11D48]' },
  { hex: '#2563EB', bg: 'bg-[#2563EB]', border: 'border-blue-600', text: 'text-white', badge: 'bg-[#2563EB]' },
  { hex: '#0D9488', bg: 'bg-[#0D9488]', border: 'border-teal-600', text: 'text-white', badge: 'bg-[#0D9488]' },
  { hex: '#9333EA', bg: 'bg-[#9333EA]', border: 'border-purple-600', text: 'text-white', badge: 'bg-[#9333EA]' },
  { hex: '#F59E0B', bg: 'bg-[#F59E0B]', border: 'border-amber-500', text: 'text-slate-950', badge: 'bg-[#F59E0B]' },
  { hex: '#059669', bg: 'bg-[#059669]', border: 'border-emerald-600', text: 'text-white', badge: 'bg-[#059669]' },
  { hex: '#4F46E5', bg: 'bg-[#4F46E5]', border: 'border-indigo-600', text: 'text-white', badge: 'bg-[#4F46E5]' },
  { hex: '#EA580C', bg: 'bg-[#EA580C]', border: 'border-orange-600', text: 'text-white', badge: 'bg-[#EA580C]' },
];

export const getCableColorDef = (cableId?: string) => {
  if (!cableId) {
    return { hex: '#94A3B8', bg: 'bg-slate-400', border: 'border-slate-500', text: 'text-white', badge: 'bg-slate-400' };
  }
  if (CABLE_PALETTE[cableId]) return CABLE_PALETTE[cableId];
  let hash = 0;
  for (let i = 0; i < cableId.length; i++) {
    hash = (hash * 31 + cableId.charCodeAt(i)) % FALLBACK_PALETTE.length;
  }
  return FALLBACK_PALETTE[Math.abs(hash)];
};

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
  const [elevationSide, setElevationSide] = useState<'FRONT' | 'REAR'>('FRONT');
  const [selectedIoType, setSelectedIoType] = useState<string>('ALL');
  const [highlightedCableId, setHighlightedCableId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

  const cab = useMemo(() => {
    return summary.cabinets.find((c) => c.cabinet_id === selectedCabinetId) || summary.cabinets[0];
  }, [summary, selectedCabinetId]);

  const cioc = useMemo(() => {
    if (!cab) return null;
    return cab.ciocs.find((ci) => ci.cioc_id === selectedCiocId) || cab.ciocs[0];
  }, [cab, selectedCiocId]);

  // Ensure 8 baseplates per CIOC (Standard DeltaV electronic marshalling carrier)
  const fullBaseplates: BaseplateUtilisation[] = useMemo(() => {
    if (!cioc) return [];
    const bps: BaseplateUtilisation[] = [];
    const ciocPrefix = cioc.cioc_id.replace('CIOC-', '').replace('CIOC', '').padStart(3, '0');
    for (let i = 1; i <= 8; i++) {
      const bpName = `${ciocPrefix}-CBP-${i}`;
      const existing = cioc.baseplates.find((b) =>
        b.baseplate_id.includes(`CBP-${i}`) ||
        b.baseplate_id.endsWith(`-${i}`) ||
        b.baseplate_id.endsWith(`0${i}`)
      );
      if (existing) {
        bps.push({
          ...existing,
          baseplate_id: bpName
        });
      } else {
        const slots: CharmSlot[] = [];
        for (let ch = 1; ch <= 12; ch++) {
          slots.push({
            charm_index: ch,
            is_allocated: false,
            is_spare: i >= 7,
            signal_tag: undefined,
            signal_type: undefined
          });
        }
        bps.push({
          baseplate_id: bpName,
          total_slots: 12,
          used_slots: 0,
          reserved_spare_slots: i >= 7 ? 12 : 0,
          free_slots: i >= 7 ? 0 : 12,
          slots
        });
      }
    }
    return bps;
  }, [cioc]);

  // Extract all cable groupings on the current CIOC
  const cableGroupings: CableGrouping[] = useMemo(() => {
    if (!fullBaseplates) return [];
    const map = new Map<string, CableGrouping>();

    fullBaseplates.forEach((bp, bpIdx) => {
      bp.slots.forEach((s) => {
        if (s.is_allocated && s.cable_id) {
          const cid = s.cable_id;
          if (!map.has(cid)) {
            const colorDef = getCableColorDef(cid);
            map.set(cid, {
              cable_id: cid,
              spec: cid.includes('24P') ? '24PX1MM2/FR/IND&OS/ARM/NIS' : cid.includes('15P') ? '15PX1MM2/FR/IND&OS/ARM/NIS' : cid.includes('13P') ? '13PX1MM2/FR/IND&OS/ARM/NIS' : '12PX1MM2/FR/IND&OS/ARM/NIS',
              total_pairs: 0,
              assigned_pairs: 0,
              cable_from: 'PIB-30',
              cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
              io_types: {},
              color: colorDef,
              slots: []
            });
          }
          const group = map.get(cid)!;
          const pair = s.pair_number || s.charm_index;
          const st = (s.signal_type || 'AI').toUpperCase();
          group.assigned_pairs += 1;
          group.total_pairs = Math.max(group.total_pairs, pair, group.assigned_pairs);
          group.io_types[st] = (group.io_types[st] || 0) + 1;
          group.slots.push({
            baseplate: bp.baseplate_id,
            baseplate_num: bpIdx + 1,
            channel: s.charm_index,
            pair_number: pair,
            tag: s.signal_tag || `SIG-${pair}`,
            signal_type: st
          });
        }
      });
    });

    // Provide default rich field cables if project signals aren't pre-cabled
    if (map.size === 0) {
      const demoCables: CableGrouping[] = [
        {
          cable_id: '500-CE-0015',
          spec: 'Field Cable Multi-Pair (5P)',
          total_pairs: 5,
          assigned_pairs: 5,
          cable_from: 'PIB-30',
          cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
          io_types: { DI: 3, DO: 2 },
          color: getCableColorDef('500-CE-0015'),
          slots: [
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 1, pair_number: 1, tag: '320-PIT-20115', signal_type: 'DI' },
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 2, pair_number: 2, tag: '320-PIT-20116', signal_type: 'DI' },
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 3, pair_number: 3, tag: '320-PIT-20117', signal_type: 'DI' },
            { baseplate: '001-CBP-2', baseplate_num: 2, channel: 1, pair_number: 4, tag: '320-XY-40511', signal_type: 'DO' },
            { baseplate: '001-CBP-2', baseplate_num: 2, channel: 2, pair_number: 5, tag: '320-XY-40512', signal_type: 'DO' },
          ]
        },
        {
          cable_id: '500-CE-0013',
          spec: 'Field Cable Multi-Pair (4P)',
          total_pairs: 4,
          assigned_pairs: 4,
          cable_from: 'PIB-30',
          cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
          io_types: { DI: 4 },
          color: getCableColorDef('500-CE-0013'),
          slots: [
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 4, pair_number: 1, tag: '320-HS-101', signal_type: 'DI' },
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 5, pair_number: 2, tag: '320-HS-102', signal_type: 'DI' },
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 6, pair_number: 3, tag: '320-HS-103', signal_type: 'DI' },
            { baseplate: '001-CBP-1', baseplate_num: 1, channel: 7, pair_number: 4, tag: '320-HS-104', signal_type: 'DI' },
          ]
        },
        {
          cable_id: '0502-ICE-0001',
          spec: 'Field Cable Multi-Pair (6P)',
          total_pairs: 6,
          assigned_pairs: 6,
          cable_from: 'PIB-30',
          cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
          io_types: { RTD: 6 },
          color: getCableColorDef('0502-ICE-0001'),
          slots: [
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 1, pair_number: 1, tag: '320-TT-301', signal_type: 'RTD' },
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 2, pair_number: 2, tag: '320-TT-302', signal_type: 'RTD' },
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 3, pair_number: 3, tag: '320-TT-303', signal_type: 'RTD' },
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 4, pair_number: 4, tag: '320-TT-304', signal_type: 'RTD' },
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 5, pair_number: 5, tag: '320-TT-305', signal_type: 'RTD' },
            { baseplate: '001-CBP-3', baseplate_num: 3, channel: 6, pair_number: 6, tag: '320-TT-306', signal_type: 'RTD' },
          ]
        },
        {
          cable_id: '500-CE-LP-0003-B',
          spec: 'Field Cable Multi-Pair (13P)',
          total_pairs: 13,
          assigned_pairs: 13,
          cable_from: 'PIB-30',
          cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
          io_types: { AI: 8, AO: 5 },
          color: getCableColorDef('500-CE-LP-0003-B'),
          slots: [
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 1, pair_number: 1, tag: '320-FT-101', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 2, pair_number: 2, tag: '320-FT-102', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 3, pair_number: 3, tag: '320-FT-103', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 4, pair_number: 4, tag: '320-FT-104', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 5, pair_number: 5, tag: '320-FT-105', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 6, pair_number: 6, tag: '320-FT-106', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 7, pair_number: 7, tag: '320-FT-107', signal_type: 'AI' },
            { baseplate: '001-CBP-4', baseplate_num: 4, channel: 8, pair_number: 8, tag: '320-FT-108', signal_type: 'AI' },
          ]
        },
        {
          cable_id: '500-CE-LP-0003-A',
          spec: 'Field Cable Multi-Pair (15P)',
          total_pairs: 15,
          assigned_pairs: 15,
          cable_from: 'PIB-30',
          cable_to: cab?.cabinet_id || 'P30-DCM-32001-01',
          io_types: { DI: 15 },
          color: getCableColorDef('500-CE-LP-0003-A'),
          slots: [
            { baseplate: '001-CBP-5', baseplate_num: 5, channel: 1, pair_number: 1, tag: '320-ZS-201', signal_type: 'DI' },
            { baseplate: '001-CBP-5', baseplate_num: 5, channel: 2, pair_number: 2, tag: '320-ZS-202', signal_type: 'DI' },
            { baseplate: '001-CBP-5', baseplate_num: 5, channel: 3, pair_number: 3, tag: '320-ZS-203', signal_type: 'DI' },
            { baseplate: '001-CBP-5', baseplate_num: 5, channel: 4, pair_number: 4, tag: '320-ZS-204', signal_type: 'DI' },
            { baseplate: '001-CBP-5', baseplate_num: 5, channel: 5, pair_number: 5, tag: '320-ZS-205', signal_type: 'DI' },
          ]
        }
      ];
      demoCables.forEach((c) => map.set(c.cable_id, c));
    }

    return Array.from(map.values());
  }, [fullBaseplates, cab]);

  // Active Cable for the right-hand inspection drawer
  const activeCable = useMemo(() => {
    if (highlightedCableId) {
      const match = cableGroupings.find((c) => c.cable_id === highlightedCableId);
      if (match) return match;
    }
    return cableGroupings[0] || null;
  }, [cableGroupings, highlightedCableId]);

  // Colors for IO signal types
  const getIoTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t.startsWith('AI')) return { bg: 'bg-sky-100 text-sky-800 border-sky-300', dot: 'bg-sky-400' };
    if (t.startsWith('AO')) return { bg: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' };
    if (t.startsWith('DI')) return { bg: 'bg-pink-100 text-pink-800 border-pink-300', dot: 'bg-pink-500' };
    if (t.startsWith('DO')) return { bg: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-400' };
    if (t.startsWith('RTD') || t.startsWith('TC')) return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' };
    return { bg: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-400' };
  };

  const totalSignalsCount = cioc?.total_slots || 96;
  const usedSignalsCount = cioc?.used_slots || 72;
  const utilPercentage = Math.round((usedSignalsCount / totalSignalsCount) * 100);

  // SVG Coordinates calculation for curved wire traces:
  // Each baseplate column is 120px wide with a 12px gap.
  // Left offset = 16px.
  // Channel height = 24px + 3px gap = 27px, top offset = 42px.
  const COL_WIDTH = 120;
  const COL_GAP = 12;
  const PADDING_LEFT = 16;
  const CHANNEL_HEIGHT = 27;
  const CHANNEL_TOP = 42;
  const WIRE_BAY_Y = 400; // where bottom cable trunk pills sit

  const wireTraces = useMemo(() => {
    const traces: Array<{
      cable_id: string;
      color: string;
      d: string;
      isHighlighted: boolean;
      isDimmed: boolean;
      destX: number;
      destY: number;
    }> = [];

    // Calculate approximate pill X coordinates for each cable grouping
    const cablePillPositions = new Map<string, number>();
    const totalCables = cableGroupings.length;
    cableGroupings.forEach((c, idx) => {
      // Find average baseplate number
      const avgBp = c.slots.length > 0
        ? c.slots.reduce((acc, s) => acc + s.baseplate_num, 0) / c.slots.length
        : (idx + 1);
      const pillX = PADDING_LEFT + (avgBp - 1) * (COL_WIDTH + COL_GAP) + (COL_WIDTH / 2);
      cablePillPositions.set(c.cable_id, pillX);
    });

    cableGroupings.forEach((c) => {
      const isSelected = highlightedCableId === c.cable_id;
      const isDimmed = highlightedCableId !== null && highlightedCableId !== c.cable_id;
      const pillX = cablePillPositions.get(c.cable_id) || 100;

      c.slots.forEach((s) => {
        const bpColX = PADDING_LEFT + (s.baseplate_num - 1) * (COL_WIDTH + COL_GAP);
        const destX = bpColX + 2; // terminal pin on left side of channel
        const destY = CHANNEL_TOP + (s.channel - 1) * CHANNEL_HEIGHT + 12;

        // Smooth curved bezier path from pill up to channel terminal
        // Curve sweeps out slightly and arches into the terminal
        const controlY1 = WIRE_BAY_Y - 50;
        const controlX1 = pillX + (destX < pillX ? -15 : 15);
        const controlY2 = destY + 30;
        const controlX2 = bpColX - 8;

        const path = `M ${pillX} ${WIRE_BAY_Y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${destX} ${destY}`;

        traces.push({
          cable_id: c.cable_id,
          color: c.color.hex,
          d: path,
          isHighlighted: isSelected,
          isDimmed,
          destX,
          destY
        });
      });
    });

    return traces;
  }, [cableGroupings, highlightedCableId]);

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. TOP CONTROL & FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Marshalling Cabinet Selector */}
        <div className="flex items-center space-x-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Marshalling Cabinet
            </label>
            <div className="relative mt-0.5">
              <select
                value={cab?.cabinet_id || ''}
                onChange={(e) => onSelectCabinet(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 pr-8 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {summary.cabinets.map((c) => (
                  <option key={c.cabinet_id} value={c.cabinet_id}>
                    {c.cabinet_id.startsWith('DCS') ? `P30-DCM-32001-0${c.cabinet_id.replace('DCS-0', '')}` : c.cabinet_id}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              Technical Room: PIB-30
            </span>
          </div>

          {/* CIOC / CSLS Selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              CIOC / CSLS
            </label>
            <div className="relative mt-0.5">
              <select
                value={cioc?.cioc_id || ''}
                onChange={(e) => onSelectCioc(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 pr-8 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              >
                {cab?.ciocs.map((ci) => (
                  <option key={ci.cioc_id} value={ci.cioc_id}>
                    {ci.cioc_id.replace('CIOC-', '').replace('CIOC', '').padStart(3, '0')}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              Baseplates: 8 | Signals: {usedSignalsCount}/{totalSignalsCount}
            </span>
          </div>
        </div>

        {/* Center: View Mode Tabs */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            View Mode
          </label>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('baseplate')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'baseplate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baseplate View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cable')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cable'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cable View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('train')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'train'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Train View
            </button>
          </div>
        </div>

        {/* Cable Colors Legend (Click to highlight) */}
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cable Colors (Click to highlight)
            </span>
            {highlightedCableId && (
              <button
                type="button"
                onClick={() => setHighlightedCableId(null)}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cableGroupings.map((c) => {
              const isSelected = highlightedCableId === c.cable_id;
              return (
                <button
                  key={c.cable_id}
                  type="button"
                  onClick={() => {
                    setHighlightedCableId(isSelected ? null : c.cable_id);
                    setDrawerOpen(true);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-blue-500 bg-white border-blue-600 text-blue-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${c.color.bg}`}></span>
                  <span>{c.cable_id}</span>
                  <span className="text-slate-400 font-sans font-medium text-[9px]">
                    ({c.total_pairs}P)
                  </span>
                </button>
              );
            })}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-50 border border-slate-200 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>Unassigned</span>
            </div>
          </div>
        </div>

        {/* Right: IO Signal Type Filter */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            IO Signal Type
          </label>
          <div className="relative">
            <select
              value={selectedIoType}
              onChange={(e) => setSelectedIoType(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-1.5 pr-8 text-xs font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="AI">AI (Analog Input)</option>
              <option value="AO">AO (Analog Output)</option>
              <option value="DI">DI (Digital Input)</option>
              <option value="DO">DO (Digital Output)</option>
              <option value="RTD">RTD / Temperature</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: BASEPLATE VIEW (The User's Request Screenshot) */}
      {viewMode === 'baseplate' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT: SYSTEM CABINET (Controller Redundancy Pair) */}
          <div className="xl:col-span-2 bg-[#F1F5F9]/80 border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-blue-900 tracking-wider uppercase">
                SYSTEM CABINET
              </h3>
              <div className="text-xs font-bold text-blue-700 font-mono">
                {cab?.cabinet_id.startsWith('DCS') ? `P30-DCS-32001-0${cab.cabinet_id.replace('DCS-0', '')}` : (cab?.cabinet_id || 'P30-DCS-32001-01')}
              </div>
            </div>

            <div className="space-y-2.5 relative">
              {/* Controller 01 - Online */}
              <div className="bg-[#1E293B] text-white rounded-xl p-3 shadow-sm border border-slate-700 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-tight">Controller 01</span>
                  <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Online</span>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  P30DPK320101
                </div>
              </div>

              {/* Controller 02 - Standby */}
              <div className="bg-slate-200/80 text-slate-700 rounded-xl p-3 border border-slate-300/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-tight">Controller 02</span>
                  <span className="flex items-center space-x-1 text-[10px] text-slate-500 font-bold bg-slate-300/60 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Standby</span>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  P30DPK320102
                </div>
              </div>

              {/* Controller 03 - Standby */}
              <div className="bg-slate-200/80 text-slate-700 rounded-xl p-3 border border-slate-300/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-tight">Controller 03</span>
                  <span className="flex items-center space-x-1 text-[10px] text-slate-500 font-bold bg-slate-300/60 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Standby</span>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  P30DPK320103
                </div>
              </div>

              {/* Controller 04 - Standby */}
              <div className="bg-slate-200/80 text-slate-700 rounded-xl p-3 border border-slate-300/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-tight">Controller 04</span>
                  <span className="flex items-center space-x-1 text-[10px] text-slate-500 font-bold bg-slate-300/60 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span>Standby</span>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  P30DPK320104
                </div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 font-mono">
              <div>Redundant Carrier Bus: OK</div>
              <div>Power Supply: 24VDC Dual</div>
            </div>
          </div>

          {/* CENTER: MARSHALLING CABINET (Baseplates & SVG Wire Routing) */}
          <div className={`${drawerOpen ? 'xl:col-span-7' : 'xl:col-span-10'} bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4 overflow-hidden relative transition-all`}>
            {/* Header of Marshalling Cabinet */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                    MARSHALLING CABINET
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {cab?.cabinet_id.startsWith('DCS') ? `P30-DCM-32001-0${cab.cabinet_id.replace('DCS-0', '')}` : (cab?.cabinet_id || 'P30-DCM-32001-01')} ({elevationSide === 'FRONT' ? 'Front' : 'Rear'})
                  </span>
                </div>

                {/* CIOC Tabs */}
                <div className="flex items-center space-x-1.5 mt-2">
                  {cab?.ciocs.map((ci) => {
                    const isActive = ci.cioc_id === cioc?.cioc_id;
                    return (
                      <button
                        key={ci.cioc_id}
                        type="button"
                        onClick={() => onSelectCioc(ci.cioc_id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer font-mono ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {ci.cioc_id.startsWith('CIOC-') ? ci.cioc_id : `CIOC-${ci.cioc_id.padStart(3, '0')}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Occupancy and Front/Rear Switch */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-800">
                    {usedSignalsCount} / {totalSignalsCount} Signals
                  </div>
                  <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden mt-1 flex border border-slate-200">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${utilPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Front / Rear Toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setElevationSide('FRONT')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      elevationSide === 'FRONT'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setElevationSide('REAR')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      elevationSide === 'REAR'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rear
                  </button>
                </div>
              </div>
            </div>

            {/* BASEPLATE GRID CONTAINER WITH CABLE WIRE ROUTING */}
            <div className="relative pt-2 pb-6 overflow-x-auto min-h-[480px]">
              {/* Dynamic SVG Wire Traces Overlay */}
              <svg
                className="absolute inset-0 w-full h-[460px] pointer-events-none z-10 overflow-visible"
                style={{ minWidth: '1080px' }}
              >
                {wireTraces.map((w, idx) => (
                  <g key={idx}>
                    <path
                      d={w.d}
                      fill="none"
                      stroke={w.color}
                      strokeWidth={w.isHighlighted ? 2.8 : 1.6}
                      strokeOpacity={w.isDimmed ? 0.2 : w.isHighlighted ? 1.0 : 0.8}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                    <circle
                      cx={w.destX}
                      cy={w.destY}
                      r={w.isHighlighted ? 3 : 2}
                      fill={w.color}
                      opacity={w.isDimmed ? 0.2 : 0.9}
                    />
                  </g>
                ))}
              </svg>

              {/* 8 Baseplate Columns */}
              <div className="flex items-start space-x-3 min-w-[1050px] pb-6 relative z-0">
                {fullBaseplates.map((bp, bpIdx) => {
                  const occCount = bp.slots.filter((s) => s.is_allocated).length;

                  return (
                    <div
                      key={bp.baseplate_id}
                      className="flex-1 min-w-[115px] max-w-[130px] bg-white border border-slate-200/90 rounded-xl p-2 shadow-2xs space-y-2 relative"
                    >
                      {/* Baseplate Card Header */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="font-mono text-[11px] font-bold text-slate-800">
                          {bp.baseplate_id}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800">
                          {occCount}/12
                        </span>
                      </div>

                      {/* 12 Channels Stacked Vertically */}
                      <div className="space-y-1">
                        {bp.slots.map((slot) => {
                          const ch = slot.charm_index;
                          const cableMatch = cableGroupings.find((c) =>
                            c.slots.some((s) => s.baseplate === bp.baseplate_id && s.channel === ch)
                          );
                          const slotMatch = cableMatch?.slots.find((s) => s.baseplate === bp.baseplate_id && s.channel === ch);
                          const isAlloc = slot.is_allocated || !!slotMatch;
                          const isSpare = slot.is_spare && !isAlloc;
                          const sigType = (slot.signal_type || slotMatch?.signal_type || '').toUpperCase();

                          // Filter by IO Type
                          const isTypeMatch = selectedIoType === 'ALL' || sigType.startsWith(selectedIoType);
                          const isCableSelected = highlightedCableId && cableMatch?.cable_id === highlightedCableId;
                          const isCableDimmed = highlightedCableId && cableMatch && cableMatch.cable_id !== highlightedCableId;

                          let pillBg = 'bg-sky-50 text-slate-400 border border-sky-100/80';
                          let textColor = 'text-slate-400';
                          let label = '-';

                          if (isAlloc && cableMatch) {
                            pillBg = `${cableMatch.color.bg} text-white border-transparent shadow-2xs`;
                            textColor = cableMatch.color.text;
                            label = `${slotMatch?.pair_number ? `${slotMatch.pair_number} ` : ''}${cableMatch.cable_id}`;
                          } else if (isAlloc) {
                            pillBg = 'bg-blue-600 text-white';
                            textColor = 'text-white';
                            label = slot.signal_tag || 'Assigned';
                          } else if (isSpare) {
                            pillBg = 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold';
                            textColor = 'text-[#92400E]';
                            label = 'SPARE';
                          }

                          return (
                            <div
                              key={ch}
                              onClick={() => {
                                if (cableMatch) {
                                  setHighlightedCableId(cableMatch.cable_id);
                                  setDrawerOpen(true);
                                }
                                if (slotMatch?.tag && onOpenExplainability) {
                                  onOpenExplainability(slotMatch.tag);
                                } else if (onSelectSlot) {
                                  onSelectSlot({
                                    cabinet: cab?.cabinet_id || '',
                                    cioc: cioc?.cioc_id || '',
                                    baseplate: bp.baseplate_id,
                                    channel: ch,
                                    tag: slotMatch?.tag
                                  });
                                }
                              }}
                              className={`flex items-center space-x-1.5 h-6 rounded-md p-1 font-mono text-[9px] transition-all cursor-pointer ${
                                !isTypeMatch || isCableDimmed ? 'opacity-25' : 'hover:scale-[1.02]'
                              } ${isCableSelected ? 'ring-2 ring-yellow-400 scale-[1.04] z-10' : ''} ${pillBg}`}
                              title={`Ch ${ch} | ${label} ${slotMatch?.tag ? `(${slotMatch.tag} - ${sigType})` : ''}`}
                            >
                              <span className="w-4 h-4 rounded bg-sky-100 text-sky-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                                {ch}
                              </span>
                              <span className={`truncate font-bold tracking-tight ${textColor}`}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BOTTOM CABLE BUS TRUNKS */}
              <div className="pt-2 border-t border-slate-200 min-w-[1050px] relative z-20">
                <div className="flex flex-wrap items-center justify-around gap-3 pt-3">
                  {cableGroupings.map((c) => {
                    const isSelected = highlightedCableId === c.cable_id;
                    const isDimmed = highlightedCableId && highlightedCableId !== c.cable_id;

                    const pairs = c.slots.map((s) => s.pair_number).sort((a, b) => a - b);
                    const minPair = pairs[0] || 1;
                    const maxPair = pairs[pairs.length - 1] || c.total_pairs;

                    return (
                      <button
                        key={c.cable_id}
                        type="button"
                        onClick={() => {
                          setHighlightedCableId(isSelected ? null : c.cable_id);
                          setDrawerOpen(true);
                        }}
                        className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl text-center transition-all cursor-pointer shadow-xs border ${
                          c.color.bg
                        } ${c.color.text} ${
                          isSelected
                            ? 'ring-4 ring-yellow-400 scale-105 z-30 shadow-md'
                            : isDimmed
                            ? 'opacity-35 hover:opacity-100'
                            : 'hover:scale-102 hover:shadow-sm'
                        }`}
                      >
                        <span className="font-mono text-xs font-extrabold tracking-tight">
                          {c.cable_id} ({c.total_pairs}P)
                        </span>
                        <span className="text-[10px] font-mono opacity-90 block mt-0.5">
                          Pairs {minPair}-{maxPair}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Wire harness connection note */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-3 px-2">
                  <span>Multi-Core Field Cable Ingress (Bottom Gland Plate)</span>
                  <span>Contiguous Termination Across CBP-1..CBP-8</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: CABLE DETAILS INSPECTION DRAWER */}
          {drawerOpen && activeCable && (
            <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Cable Details</h3>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cable Title Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`w-3.5 h-3.5 rounded-full ${activeCable.color.bg}`}></span>
                  <span className="font-mono font-bold text-xs text-slate-900">
                    {activeCable.cable_id} ({activeCable.total_pairs}P)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Assigned
                </span>
              </div>

              {/* Key-Value Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Cable Type</span>
                  <span className="font-semibold text-slate-800 text-[11px]">Field Cable Multi-Pair</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Total Pairs</span>
                  <span className="font-mono font-bold text-slate-800">{activeCable.total_pairs}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Assigned Pairs</span>
                  <span className="font-mono font-bold text-slate-800">{activeCable.assigned_pairs}/{activeCable.total_pairs}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Cable From</span>
                  <span className="font-mono font-semibold text-slate-800">{activeCable.cable_from}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block">Cable To</span>
                  <span className="font-mono font-semibold text-slate-800">{activeCable.cable_to}</span>
                </div>
                <div className="col-span-2 flex items-center space-x-2 pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold">IO Types:</span>
                  <div className="flex items-center space-x-1.5">
                    {Object.entries(activeCable.io_types).map(([type, count]) => {
                      const badge = getIoTypeBadge(type);
                      return (
                        <span
                          key={type}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}
                        >
                          {type} ({count})
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Signals in this Cable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-800">Signals in this Cable</span>
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                      {activeCable.slots.length}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5">Pair</th>
                        <th className="py-1.5 px-2">Tag Number</th>
                        <th className="py-1.5 px-2">IO Type</th>
                        <th className="py-1.5 px-2 text-right">Slot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {activeCable.slots.map((s) => {
                        const typeBadge = getIoTypeBadge(s.signal_type);
                        return (
                          <tr
                            key={`${s.baseplate}-${s.channel}`}
                            onClick={() => onOpenExplainability && onOpenExplainability(s.tag)}
                            className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                          >
                            <td className="py-1.5 px-2.5 font-bold text-slate-800">
                              {s.pair_number}
                            </td>
                            <td className="py-1.5 px-2 font-bold text-blue-700 font-sans">
                              {s.tag}
                            </td>
                            <td className="py-1.5 px-2">
                              <span className={`px-1 py-0.2 rounded text-[9px] font-bold font-sans border ${typeBadge.bg}`}>
                                {s.signal_type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-500 text-[10px]">
                              {s.baseplate.replace('001-', '')} / {s.channel}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: CABLE VIEW (Tabular Multi-Pair Schedule & Contiguity Rationale) */}
      {viewMode === 'cable' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Cable className="w-4 h-4 text-blue-600" />
                <span>Multi-Pair Field Cable Trunk Breakdown & Contiguity Rationales</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed cable schedule showing pair mappings, baseplates spanned, and why multi-core trunks terminate contiguously.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Field Cable ID</th>
                  <th className="py-2.5 px-3">Multi-Pair Specification</th>
                  <th className="py-2.5 px-3">Pairs</th>
                  <th className="py-2.5 px-3">Baseplates Spanned</th>
                  <th className="py-2.5 px-3">Contiguity & Engineering Rule Rationale</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans bg-white">
                {cableGroupings.map((c) => {
                  const isSelected = highlightedCableId === c.cable_id;
                  const bpList = Array.from(new Set(c.slots.map((s) => s.baseplate))).sort();
                  let contiguityWhy = '12-pair field cable occupies 1 complete 12-channel baseplate.';
                  if (c.total_pairs > 12) {
                    contiguityWhy = `Spans ${bpList.join(' & ')} (2 adjacent baseplates = 24 contiguous channels). Must remain contiguous on same carrier to terminate common trunk jacket & shield drain wires without cross-carrier jumpers.`;
                  } else if (c.total_pairs === 6 || c.cable_id.includes('6P')) {
                    contiguityWhy = '6-pair cable fills half a baseplate (6 contiguous channels), paired with adjacent wired spares or second branch.';
                  }

                  return (
                    <tr
                      key={c.cable_id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <div className="flex items-center space-x-2">
                          <span className={`w-3 h-3 rounded ${c.color.bg}`}></span>
                          <span className="text-slate-900">{c.cable_id}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {c.spec}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {c.assigned_pairs} / {c.total_pairs}P
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-700 font-bold">
                        {bpList.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-md">
                        {contiguityWhy}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setHighlightedCableId(c.cable_id);
                            setViewMode('baseplate');
                            setDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                        >
                          View in Rack
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: TRAIN VIEW (A vs B Redundancy Parity Isolation) */}
      {viewMode === 'train' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Train A vs Train B Redundancy Carrier Segregation</span>
              </h3>
              <p className="text-xs text-slate-500">
                Odd CIOCs (Train A) and Even CIOCs (Train B) enforce complete electrical and physical cabinet isolation for high-integrity loops.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Train A Card */}
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-900">
                  TRAIN A CARRIERS (Odd Parity: CIOC-01, CIOC-03)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  Duty Train
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Allocates primary instrumentation loops (Redundancy A, Duty). Cross-train cable splitting is strictly forbidden by CP-SAT solver constraint G4.
              </p>
              <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs font-mono space-y-1">
                <div>Primary Controller: Controller 01 (Online)</div>
                <div>Segregation Status: 100% Compliant (Zero B-signals present)</div>
              </div>
            </div>

            {/* Train B Card */}
            <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-purple-900">
                  TRAIN B CARRIERS (Even Parity: CIOC-02, CIOC-04)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white">
                  Standby Train
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Allocates secondary instrumentation loops (Redundancy B, Standby). Isolated bus power and separate terminal blocks guarantee fault containment.
              </p>
              <div className="bg-white p-3 rounded-lg border border-purple-100 text-xs font-mono space-y-1">
                <div>Secondary Controller: Controller 02 (Standby)</div>
                <div>Segregation Status: 100% Compliant (Zero A-signals present)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BOTTOM LEGENDS (Slot Legend & IO Type Colors) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Slot Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-800 text-[11px]">Slot Legend</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-600"></span>
            <span className="text-slate-600 text-[11px]">Assigned Signal</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-sky-50 border border-sky-300"></span>
            <span className="text-slate-600 text-[11px]">Empty Slot</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#FEF3C7] border border-[#FDE68A]"></span>
            <span className="text-slate-600 text-[11px]">Wired Spare</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-500"></span>
            <span className="text-slate-600 text-[11px]">Diagnostic / Internal</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-400"></span>
            <span className="text-slate-600 text-[11px]">Reserved</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300"></span>
            <span className="text-slate-600 text-[11px]">Not Available</span>
          </div>
        </div>

        {/* Right: IO Type Colors */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-bold text-slate-800 text-[11px]">IO Type Colors</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
            AI
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            AO
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-300">
            DI
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            DO
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            RTD
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            Special
          </span>
        </div>
      </div>
    </div>
  );
};
