import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Table,
  FileCheck,
  Search,
  Filter
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/ui/StatusBadge';

export const ImportWizardPage: React.FC = () => {
  const { currentProject, currentRevision, refreshProjects, refreshRevisions } = useProject();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Column mappings
  const [mapping, setMapping] = useState<{
    tag: string;
    description: string;
    signal_type: string;
    cable_id: string;
    pair_number: string;
    redundancy: string;
    logical_group: string;
  }>({
    tag: '',
    description: '',
    signal_type: '',
    cable_id: '',
    pair_number: '',
    redundancy: '',
    logical_group: '',
  });

  // Preview signals parsed
  const [previewSignals, setPreviewSignals] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [searchPreview, setSearchPreview] = useState('');

  // Handle file drop/upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files[0];
    } else if (e.target.files) {
      file = e.target.files[0];
    }

    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('Please upload a valid Excel spreadsheet (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    try {
      setLoading(true);
      const data = await api.inspectWorkbook(file);
      setInspectData(data);
      const firstSheet = data.sheets[0] || '';
      setSelectedSheet(firstSheet);

      // Apply suggested mappings if detected
      const suggested = data.suggested_mappings || {};
      const headers = data.sheet_headers[firstSheet] || [];
      setMapping({
        tag: suggested.tag || headers.find((h: string) => /tag/i.test(h)) || '',
        description: suggested.description || headers.find((h: string) => /desc/i.test(h)) || '',
        signal_type: suggested.signal_type || headers.find((h: string) => /type/i.test(h)) || '',
        cable_id: suggested.cable_id || headers.find((h: string) => /cable/i.test(h)) || '',
        pair_number: suggested.pair_number || headers.find((h: string) => /pair/i.test(h)) || '',
        redundancy: suggested.redundancy || headers.find((h: string) => /red/i.test(h)) || '',
        logical_group: suggested.logical_group || headers.find((h: string) => /group|unit/i.test(h)) || '',
      });
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect workbook');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    if (inspectData && inspectData.sheet_headers[sheet]) {
      const headers = inspectData.sheet_headers[sheet];
      setMapping({
        tag: headers.find((h: string) => /tag/i.test(h)) || '',
        description: headers.find((h: string) => /desc/i.test(h)) || '',
        signal_type: headers.find((h: string) => /type/i.test(h)) || '',
        cable_id: headers.find((h: string) => /cable/i.test(h)) || '',
        pair_number: headers.find((h: string) => /pair/i.test(h)) || '',
        redundancy: headers.find((h: string) => /red/i.test(h)) || '',
        logical_group: headers.find((h: string) => /group|unit/i.test(h)) || '',
      });
    }
  };

  // Preview generation
  const handleProceedToPreview = () => {
    if (!mapping.tag) {
      setErrorMsg('Please map the mandatory Signal Tag column.');
      return;
    }
    if (!mapping.signal_type) {
      setErrorMsg('Please map the mandatory Signal Type column.');
      return;
    }
    setErrorMsg(null);

    // Build client preview from inspectData preview rows
    const rows = inspectData.sheet_data_preview[selectedSheet] || [];
    const signals = rows.map((r: any, idx: number) => {
      const tag = r[mapping.tag] || '';
      const type = r[mapping.signal_type] || '';
      const desc = r[mapping.description] || '';
      const cable = r[mapping.cable_id] || '';
      const pair = r[mapping.pair_number] || '';
      const red = r[mapping.redundancy] || '';
      const group = r[mapping.logical_group] || '';
      const isValid = Boolean(tag && type && ['AI', 'AO', 'DI', 'DO', 'DO-SOV', 'RTD', 'TC'].includes(type.toUpperCase()));

      return {
        id: idx + 1,
        tag,
        description: desc,
        signal_type: type,
        cable_id: cable,
        pair_number: pair,
        redundancy: red,
        logical_group: group,
        is_valid: isValid,
        warning: !isValid ? 'Invalid or unknown signal type' : undefined
      };
    });

    setPreviewSignals(signals);
    setStep(3);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!currentProject || !currentRevision || !inspectData) return;
    try {
      setLoading(true);
      const res = await api.importMappedSignals(
        currentProject.id,
        currentRevision.id,
        inspectData.temp_file_path,
        selectedSheet,
        mapping
      );
      setImportSummary(res);
      await refreshProjects();
      await refreshRevisions();
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Wizard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>Customer IO Data Import Wizard</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step ingestion, schema alignment, and pre-validation for {currentProject?.name} ({currentRevision?.revision_code}).
          </p>
        </div>

        {/* Sample File Download Shortcuts */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-slate-400 font-medium">Download Synthetic Workbooks:</span>
          <a
            href={api.getSampleFileUrl('Customer_IO_List_RevA.xlsx')}
            download
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3 h-3 text-blue-600" />
            <span>Rev A (.xlsx)</span>
          </a>
          <a
            href={api.getSampleFileUrl('Customer_IO_List_RevB.xlsx')}
            download
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3 h-3 text-purple-600" />
            <span>Rev B (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { num: 1, label: 'Upload Workbooks', desc: 'Accept .xlsx / .xls' },
          { num: 2, label: 'Sheet & Column Mapping', desc: 'Schema Alignment' },
          { num: 3, label: 'Pre-Validation Preview', desc: 'Verify Signal Integrity' },
          { num: 4, label: 'Import Confirmation', desc: 'Ready for Allocation' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-3 rounded-lg border transition-all ${
              step === s.num
                ? 'bg-blue-50 border-blue-500 shadow-xs'
                : step > s.num
                ? 'bg-emerald-50/40 border-emerald-300 text-slate-700'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? 'bg-blue-600 text-white'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <div>
                <div className={`text-xs font-bold ${step === s.num ? 'text-blue-900' : 'text-slate-800'}`}>
                  {s.label}
                </div>
                <div className="text-[10px] text-slate-500">{s.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileUpload}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-10 text-center flex flex-col items-center justify-center bg-slate-50/50 hover:bg-blue-50/20 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Drag and drop customer IO Excel workbook here</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports .xlsx and .xls formats. The parser inspects sheets, detects headers, and handles custom column structures automatically.
            </p>

            <label className="mt-5 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer transition-colors">
              <span>Select File from Computer</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start space-x-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-800">Macro Security & Engineering Assurance</span>
              <p>Uploaded workbooks are parsed safely in memory using read-only OpenPyXL/Pandas. No embedded macros or executable code are run.</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Sheet & Column Mapping */}
      {step === 2 && inspectData && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Select Worksheet & Align Column Mappings</h3>
              <p className="text-xs text-slate-500">
                Workbook: <span className="font-mono text-blue-600 font-semibold">{inspectData.filename}</span> ({inspectData.file_size_kb} KB)
              </p>
            </div>

            {/* Sheet Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-700">Target Sheet:</span>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-hidden"
              >
                {inspectData.sheets.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'tag', label: 'Signal Tag *', req: true, desc: 'Instrument / Tag name (e.g. PT-1001, FT-2001)' },
              { key: 'signal_type', label: 'Signal Type *', req: true, desc: 'IO Type: AI, AO, DI, DO, DO-SOV, RTD, TC' },
              { key: 'description', label: 'Signal Description', req: false, desc: 'Service or equipment process description' },
              { key: 'cable_id', label: 'Field Cable Tag / ID', req: false, desc: 'Multi-pair cable identifier (e.g. CB-01)' },
              { key: 'pair_number', label: 'Wire Pair Number', req: false, desc: 'Pair index within cable (1..24)' },
              { key: 'redundancy', label: 'Redundancy Designator', req: false, desc: 'Segregation channel: A or B' },
              { key: 'logical_group', label: 'Logical Group / Unit', req: false, desc: 'Unit or process grouping (e.g. Boiler, Turbine)' },
            ].map((col) => {
              const headers = inspectData.sheet_headers[selectedSheet] || [];
              const currVal = (mapping as any)[col.key] || '';
              return (
                <div key={col.key} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      {col.label}
                    </label>
                    {col.req && <span className="text-[10px] text-rose-600 font-bold">REQUIRED</span>}
                  </div>
                  <p className="text-[11px] text-slate-500">{col.desc}</p>
                  <select
                    value={currVal}
                    onChange={(e) => setMapping({ ...mapping, [col.key]: e.target.value })}
                    className={`w-full text-xs px-2.5 py-1.5 border rounded-md bg-white focus:outline-hidden ${
                      col.req && !currVal ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  >
                    <option value="">— Select Source Column —</option>
                    {headers.map((h: string) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Upload</span>
            </button>
            <button
              onClick={handleProceedToPreview}
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors"
            >
              <span>Validate & Preview Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Parsed Data Integrity Preview</h3>
              <p className="text-xs text-slate-500">
                Sample preview rows extracted using mapped schema. Review status before committing to revision.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchPreview}
                onChange={(e) => setSearchPreview(e.target.value)}
                placeholder="Filter preview signals..."
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-hidden"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Tag Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Cable</th>
                  <th className="py-2.5 px-3">Pair</th>
                  <th className="py-2.5 px-3">Redundancy</th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewSignals
                  .filter((s) => !searchPreview || s.tag.toLowerCase().includes(searchPreview.toLowerCase()))
                  .map((sig) => (
                    <tr key={sig.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-400">{sig.id}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{sig.tag}</td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {sig.signal_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-xs">{sig.description}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{sig.cable_id || '—'}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{sig.pair_number || '—'}</td>
                      <td className="py-2 px-3 font-mono">
                        {sig.redundancy ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {sig.redundancy}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{sig.logical_group || '—'}</td>
                      <td className="py-2 px-3">
                        <StatusBadge status={sig.is_valid ? 'Valid' : 'Needs Review'} size="sm" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mapping</span>
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={loading}
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors"
            >
              {loading ? (
                <span>Importing & Indexing...</span>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Commit Import to {currentRevision?.revision_code}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success Confirmation */}
      {step === 4 && importSummary && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">IO Data Imported Successfully!</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {importSummary.imported_count} signals committed into project database for{' '}
            <span className="font-semibold text-slate-800">{currentRevision?.revision_code}</span>.
          </p>

          <div className="max-w-xs mx-auto bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Imported:</span>
              <span className="font-bold font-mono text-slate-900">{importSummary.imported_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Flagged Anomalies:</span>
              <span className="font-bold font-mono text-amber-600">{importSummary.invalid_count}</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center space-x-3">
            <button
              onClick={() => navigate('/rules-hardware')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Verify Hardware & Rules
            </button>
            <button
              onClick={() => navigate('/allocation')}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
            >
              Open Allocation Workspace →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
