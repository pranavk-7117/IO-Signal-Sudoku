import React, { useState, useEffect } from 'react';
import { X, QrCode, Printer, Download, Server, Cpu, Layers, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { FieldQRLabel } from '../types';

interface QRLabelsModalProps {
  projectId: number;
  revisionId?: number;
  onClose: () => void;
}

export const QRLabelsModal: React.FC<QRLabelsModalProps> = ({
  projectId,
  revisionId,
  onClose
}) => {
  const [labels, setLabels] = useState<FieldQRLabel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<string>('ALL');

  useEffect(() => {
    loadLabels();
  }, [projectId, revisionId]);

  const loadLabels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQRLabels(projectId, revisionId);
      setLabels(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate field QR labels');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const cabinets = ['ALL', ...Array.from(new Set(labels.map((l) => l.cabinet)))];
  const filteredLabels = selectedCabinet === 'ALL' ? labels : labels.filter((l) => l.cabinet === selectedCabinet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Marshalling Baseplate & Cabinet QR Labels</h3>
              <p className="text-xs text-slate-500">
                Printable field QR stickers for cabinets. Scanning instantly loads loop check and termination schedules.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Sticker Sheets</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">Filter Cabinet:</span>
            <select
              value={selectedCabinet}
              onChange={(e) => setSelectedCabinet(e.target.value)}
              className="text-xs font-mono font-bold px-3 py-1 border border-slate-300 rounded-lg bg-white"
            >
              {cabinets.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <span className="text-slate-500 font-mono">
            {filteredLabels.length} Baseplate Label Cards Generated
          </span>
        </div>

        {/* Labels Grid */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Formatting field QR labels for physical cabinets...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLabels.map((lbl) => (
              <div
                key={lbl.label_id}
                className="p-4 bg-white border-2 border-slate-300 rounded-xl space-y-3 shadow-2xs hover:border-indigo-400 transition-colors"
              >
                {/* Sticker Header */}
                <div className="flex items-start justify-between pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 font-mono block uppercase">
                      {lbl.technical_room} · {lbl.cabinet}
                    </span>
                    <h4 className="text-xs font-extrabold font-mono text-slate-900">
                      {lbl.cioc} / {lbl.baseplate}
                    </h4>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {lbl.assigned_signals_count}/12 CHANNELS
                  </span>
                </div>

                {/* QR Code and Channels */}
                <div className="flex items-center space-x-3">
                  {/* Clean SVG QR Representation */}
                  <div className="w-20 h-20 bg-slate-50 border-2 border-slate-800 rounded-lg p-1.5 flex flex-col items-center justify-center shrink-0">
                    <QrCode className="w-14 h-14 text-slate-900" />
                    <span className="text-[7px] font-mono text-slate-500 font-bold mt-0.5">SCAN FIELD</span>
                  </div>

                  {/* Channels Summary */}
                  <div className="flex-1 grid grid-cols-2 gap-1 text-[9px] font-mono">
                    {lbl.channels.slice(0, 8).map((ch) => (
                      <div
                        key={ch.channel}
                        className={`px-1.5 py-0.5 rounded border truncate ${
                          ch.is_spare
                            ? 'bg-slate-50 border-slate-200 text-slate-400'
                            : 'bg-blue-50 border-blue-200 text-blue-900 font-bold'
                        }`}
                      >
                        CH{ch.channel}: {ch.tag}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-1 text-[9px] font-mono text-slate-400 truncate border-t border-slate-100">
                  Payload: {lbl.qr_payload}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};