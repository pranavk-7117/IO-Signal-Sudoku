import React, { useState } from 'react';
import { Layers, HelpCircle, Eye, Server } from 'lucide-react';
import { UtilisationSummary } from '../types';

interface CabinetElevationViewProps {
  summary: UtilisationSummary;
  selectedCabinetId: string;
  onSelectSlot?: (slot: {
    cabinet: string;
    cioc: string;
    baseplate: string;
    channel: number;
    tag?: string;
  }) => void;
  onOpenExplainability?: (tag: string) => void;
}

export const CabinetElevationView: React.FC<CabinetElevationViewProps> = ({
  summary,
  selectedCabinetId,
  onSelectSlot,
  onOpenExplainability
}) => {
  const [elevationSide, setElevationSide] = useState<'FRONT' | 'REAR'>('FRONT');
  const [hoveredSlot, setHoveredSlot] = useState<any | null>(null);

  const cab = summary.cabinets.find((c) => c.cabinet_id === selectedCabinetId) || summary.cabinets[0];
  if (!cab) return null;

  // Split CIOCs between Front and Rear elevation:
  // First half are Front (F) carriers, second half are Rear (R) carriers
  const totalCiocs = cab.ciocs.length;
  const halfCiocs = Math.ceil(totalCiocs / 2);
  const activeCiocs = elevationSide === 'FRONT' ? cab.ciocs.slice(0, halfCiocs) : cab.ciocs.slice(halfCiocs);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
      {/* Elevation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cabinet Elevation Walkthrough — {cab.cabinet_id}
            </h3>
            <p className="text-xs text-slate-500">
              Physical marshalling rack layout showing Front (F) and Rear (R) carrier elevations
            </p>
          </div>
        </div>

        {/* Front / Rear Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setElevationSide('FRONT')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              elevationSide === 'FRONT'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Front Elevation (F)
          </button>
          <button
            type="button"
            onClick={() => setElevationSide('REAR')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              elevationSide === 'REAR'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rear Elevation (R)
          </button>
        </div>
      </div>

      {/* Hover Info Banner */}
      {hoveredSlot ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-blue-700">
              {hoveredSlot.cioc} / {hoveredSlot.baseplate} / CH{hoveredSlot.charm_index}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-800 font-bold font-sans">
              {hoveredSlot.signal_tag ? hoveredSlot.signal_tag : hoveredSlot.is_spare ? 'Reserved Spare' : 'Unused Free Slot'}
            </span>
            {hoveredSlot.signal_type && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 font-bold font-sans">
                {hoveredSlot.signal_type}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-sans">
            Click slot to test "Why not here?" counterfactual
          </span>
        </div>
      ) : (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
          Hover over any CHARM position to inspect electrical and logical mapping details.
        </div>
      )}

      {/* Industrial Rack Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-950 p-5 rounded-2xl border-2 border-slate-800 shadow-xl">
        {activeCiocs.map((cioc, ciocIdx) => (
          <div key={cioc.cioc_id} className="bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 space-y-3 shadow-inner">
            {/* CIOC Carrier Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-l-4 border-l-blue-400 text-white px-3.5 py-2 rounded-lg text-xs font-mono shadow-xs">
              <span className="font-bold tracking-tight">
                CARRIER {ciocIdx + 1} ({elevationSide}): {cioc.cioc_id}
              </span>
              <span className="text-[10px] text-slate-300">
                {cioc.used_slots} / {cioc.total_slots} Slots ({cioc.reserved_spare_slots} Spares)
              </span>
            </div>

            {/* Baseplate Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cioc.baseplates.map((bp) => (
                <div
                  key={bp.baseplate_id}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-300">
                    <span className="text-sky-400 font-extrabold">{bp.baseplate_id}</span>
                    <span className="text-slate-400">{bp.used_slots}/12</span>
                  </div>

                  {/* 12 CHARMs Grid */}
                  <div className="grid grid-cols-6 gap-0.5">
                    {bp.slots.map((slot) => {
                      let bg = 'bg-slate-950 border-slate-800 text-slate-600 hover:border-sky-500 hover:text-sky-300';
                      const st = (slot.signal_type || '').toUpperCase();

                      if (slot.is_allocated) {
                        if (st.includes('ALARM') || st.includes('EJA')) bg = 'bg-amber-500 text-white border-amber-600';
                        else if (st.startsWith('AI')) bg = 'bg-blue-600 text-white border-blue-700';
                        else if (st.startsWith('AO')) bg = 'bg-cyan-600 text-white border-cyan-700';
                        else if (st.startsWith('DI')) bg = 'bg-emerald-600 text-white border-emerald-700';
                        else if (st.includes('SOV') || st.includes('SOLENOID')) bg = 'bg-rose-600 text-white border-rose-700';
                        else if (st.startsWith('DO')) bg = 'bg-indigo-600 text-white border-indigo-700';
                        else bg = 'bg-violet-600 text-white border-violet-700';
                      } else if (slot.is_spare) {
                        bg = 'bg-amber-500/25 border-amber-500/70 text-amber-300';
                      }

                      return (
                        <div
                          key={slot.charm_index}
                          onMouseEnter={() =>
                            setHoveredSlot({
                              ...slot,
                              cioc: cioc.cioc_id,
                              baseplate: bp.baseplate_id
                            })
                          }
                          onMouseLeave={() => setHoveredSlot(null)}
                          onClick={() => {
                            if (slot.signal_tag && onOpenExplainability) {
                              onOpenExplainability(slot.signal_tag);
                            } else if (onSelectSlot) {
                              onSelectSlot({
                                cabinet: cab.cabinet_id,
                                cioc: cioc.cioc_id,
                                baseplate: bp.baseplate_id,
                                channel: slot.charm_index,
                                tag: slot.signal_tag
                              });
                            }
                          }}
                          className={`h-7 rounded flex flex-col items-center justify-center font-mono text-[8px] font-bold border transition-all cursor-pointer hover:scale-110 shadow-2xs ${bg}`}
                          title={`CH${slot.charm_index}: ${slot.signal_tag || (slot.is_spare ? 'Wired Spare' : 'Spare Slot')}`}
                        >
                          <span>{slot.charm_index}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};