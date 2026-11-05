import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  FileText,
  Upload,
  CheckCircle,
  Sliders,
  Eye,
  Save,
  AlertCircle,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function AdminOfferTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Editor state
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Canvas visual editor state
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const canvasRef = useRef(null);

  // Activation modal
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activating, setActivating] = useState(false);

  // Preview state
  const [previewing, setPreviewing] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.adminGetOfferTemplates();
      if (res.success) {
        setTemplates(res.templates || []);
        if (res.templates && res.templates.length > 0) {
          // Select active template or latest
          const active = res.templates.find((t) => t.isActive) || res.templates[0];
          selectTemplate(active);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch offer templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setFields(template.fields ? JSON.parse(JSON.stringify(template.fields)) : []);
    setSelectedFieldIndex(0);
    setActivePage(1);
    setSaveMessage('');
  };

  const handleFieldChange = (index, key, val) => {
    const updated = [...fields];
    updated[index][key] = val;
    setFields(updated);
  };

  const handleCanvasPointerMove = (e) => {
    if (draggingIndex === null || !canvasRef.current || selectedTemplate?.isSample) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (clientX === undefined || clientY === undefined) return;

    const rawX = ((clientX - rect.left) / rect.width) * 595.28;
    const rawY = ((clientY - rect.top) / rect.height) * 841.89;

    const clampedX = Math.max(10, Math.min(550, Math.round(rawX)));
    const clampedY = Math.max(10, Math.min(820, Math.round(rawY)));

    handleFieldChange(draggingIndex, 'x', clampedX);
    handleFieldChange(draggingIndex, 'y', clampedY);
  };

  const handleCanvasPointerUp = () => {
    setDraggingIndex(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a PDF file to upload.');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('templatePdf', uploadFile);
      if (uploadName.trim()) {
        formData.append('name', uploadName.trim());
      }

      const res = await api.adminUploadOfferTemplate(formData);
      if (res.success) {
        setUploadFile(null);
        setUploadName('');
        await fetchTemplates();
        if (res.template) {
          selectTemplate(res.template);
        }
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to upload template PDF.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedTemplate) return;
    if (selectedTemplate.isSample) {
      alert('The sample template is built-in and read-only.');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    try {
      const res = await api.adminUpdateOfferTemplate(selectedTemplate._id, {
        fields
      });
      if (res.success) {
        if (res.isNewVersion) {
          setSaveMessage(`Active template branched into new draft version v${res.template.version}.`);
          await fetchTemplates();
          selectTemplate(res.template);
        } else {
          setSaveMessage('Field coordinates saved successfully.');
          setSelectedTemplate(res.template);
        }
      }
    } catch (err) {
      alert(err.message || 'Error saving template draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate) return;
    setPreviewing(true);
    try {
      const res = await api.adminPreviewOfferTemplate(selectedTemplate._id, { fields });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Preview generation failed');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      alert(err.message || 'Failed to preview template PDF');
    } finally {
      setPreviewing(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedTemplate) return;
    setActivating(true);
    try {
      const res = await api.adminActivateOfferTemplate(selectedTemplate._id, {
        confirmation: true
      });
      if (res.success) {
        setShowActivateModal(false);
        alert(`Template "${res.template.name}" v${res.template.version} is now ACTIVE for all new offer letters.`);
        await fetchTemplates();
      }
    } catch (err) {
      alert(err.message || 'Failed to activate template');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            Offer Letter Template Studio
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Replaceable PDF template engine. Upload custom PDFs, map dynamic field coordinates, preview test renders, and activate for official issuance.
          </p>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template List & Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Upload New Template Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-500" />
              Upload Custom PDF
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload an official offer letter PDF (1–5 pages, up to 10 MB). The engine will preserve all background graphics and map dynamic applicant text.
            </p>

            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Template Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official 2026 Cohort Offer"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  PDF File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />
              </div>

              {uploadError && (
                <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">
                  {uploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                {uploading ? 'Validating & Uploading...' : 'Upload as New Draft'}
              </button>
            </form>
          </div>

          {/* Template List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Available Templates</h2>
            {loading ? (
              <p className="text-xs text-slate-400">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-xs text-slate-400">No templates found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate?._id === tpl._id;
                  return (
                    <button
                      key={tpl._id}
                      onClick={() => selectTemplate(tpl)}
                      className={`w-full text-left p-3 rounded-lg transition my-1 flex items-start justify-between ${
                        isSelected ? 'bg-amber-50/70 border border-amber-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{tpl.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-600">
                            v{tpl.version}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {tpl.isSample ? (
                            <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-semibold">
                              Built-in Sample
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                              Custom PDF
                            </span>
                          )}
                          <span>{tpl.pageCount || 1} page(s)</span>
                        </div>
                      </div>

                      <div>
                        {tpl.isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Coordinate Editor & Controls */}
        <div className="space-y-6 lg:col-span-2">
          {selectedTemplate ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
              {/* Template Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      v{selectedTemplate.version}
                    </span>
                    {selectedTemplate.isActive && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Active for Issuance
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedTemplate.isSample
                      ? 'This is the built-in development sample template. It cannot be edited or activated for live student emails.'
                      : 'Configure the exact point coordinates for candidate text on your uploaded PDF.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreview}
                    disabled={previewing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-lg text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {previewing ? 'Rendering...' : 'Preview PDF'}
                  </button>

                  {!selectedTemplate.isActive && !selectedTemplate.isSample && (
                    <button
                      onClick={() => setShowActivateModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Activate for Issuance
                    </button>
                  )}
                </div>
              </div>

              {saveMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  {saveMessage}
                </div>
              )}

              {selectedTemplate.isActive && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Active Template Versioning:</span> This template is currently active for issuing offer letters. Modifying and saving will automatically branch a new draft version (v{selectedTemplate.version + 1}), ensuring that previously issued offer letters and their digital signatures remain immutable.
                  </div>
                </div>
              )}

              {/* Visual A4 Canvas & Drag Placement */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    <span>Visual A4 Canvas &amp; Drag Placement</span>
                  </div>
                  {selectedTemplate.pageCount > 1 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-500">Page:</span>
                      {Array.from({ length: selectedTemplate.pageCount }).map((_, i) => (
                        <button
                          key={i + 1}
                          type="button"
                          onClick={() => setActivePage(i + 1)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            activePage === i + 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col items-center">
                  <div className="text-[11px] text-slate-500 mb-2">
                    Click a marker to select it, or drag across the sheet to adjust position live. Coordinates synchronize with the controls below.
                  </div>

                  <div
                    ref={canvasRef}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerLeave={handleCanvasPointerUp}
                    className="relative w-full max-w-[340px] aspect-[595.28/841.89] bg-white border-2 border-slate-300 rounded shadow-md overflow-hidden select-none cursor-crosshair"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px)',
                      backgroundSize: '16px 16px'
                    }}
                  >
                    <div className="absolute top-2 left-2 text-[9px] font-mono text-slate-400 pointer-events-none">
                      A4 (595 &times; 842 pt) · Page {activePage}
                    </div>

                    {fields
                      .map((f, idx) => ({ ...f, origIdx: idx }))
                      .filter((f) => (f.page || 1) === activePage)
                      .map((f) => {
                        const isSelected = selectedFieldIndex === f.origIdx;
                        const leftPercent = (f.x / 595.28) * 100;
                        const topPercent = (f.y / 841.89) * 100;
                        const widthPercent = Math.min(100 - leftPercent, ((f.maxWidth || 400) / 595.28) * 100);

                        return (
                          <div
                            key={f.id || f.origIdx}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedFieldIndex(f.origIdx);
                              if (!selectedTemplate.isSample) setDraggingIndex(f.origIdx);
                            }}
                            style={{
                              left: `${leftPercent}%`,
                              top: `${topPercent}%`,
                              width: `${widthPercent}%`
                            }}
                            className={`absolute -translate-y-1/2 p-1 rounded border text-[10px] font-mono select-none transition-shadow ${
                              isSelected
                                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300 z-30'
                                : 'bg-white/95 text-slate-800 border-slate-300 shadow-xs hover:border-amber-400 z-10'
                            } ${selectedTemplate.isSample ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                          >
                            <div className="flex items-center justify-between gap-1 overflow-hidden">
                              <span className="font-bold truncate text-[9px] leading-tight">{f.label}</span>
                              <span className="text-[8px] opacity-80 shrink-0">
                                {f.x},{f.y}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Dynamic Coordinate Mappings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Numeric Field Coordinate Mappings (A4 Points)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    A4 page size: 595 &times; 842 pt
                  </span>
                </div>

                <div className="space-y-3">
                  {fields.map((f, idx) => {
                    const isSelected = selectedFieldIndex === idx;
                    return (
                      <div
                        key={f.id || idx}
                        onClick={() => setSelectedFieldIndex(idx)}
                        className={`p-3.5 rounded-lg border transition space-y-3 cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-200'
                            : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">
                            {f.label} <span className="font-mono text-slate-400 text-[10px]">({f.id})</span>
                            {f.isRequired && <span className="text-rose-500 ml-1">*</span>}
                          </span>
                          <span className="text-[10px] text-slate-400">Page {f.page || 1}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">X (pt)</label>
                            <input
                              type="number"
                              disabled={selectedTemplate.isSample}
                              value={f.x}
                              onChange={(e) => handleFieldChange(idx, 'x', Number(e.target.value))}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Y (from top pt)</label>
                            <input
                              type="number"
                              disabled={selectedTemplate.isSample}
                              value={f.y}
                              onChange={(e) => handleFieldChange(idx, 'y', Number(e.target.value))}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Font Size</label>
                            <input
                              type="number"
                              disabled={selectedTemplate.isSample}
                              value={f.fontSize || 12}
                              onChange={(e) => handleFieldChange(idx, 'fontSize', Number(e.target.value))}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Max Width (pt)</label>
                            <input
                              type="number"
                              disabled={selectedTemplate.isSample}
                              value={f.maxWidth || 450}
                              onChange={(e) => handleFieldChange(idx, 'maxWidth', Number(e.target.value))}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Align</label>
                            <select
                              disabled={selectedTemplate.isSample}
                              value={f.alignment || 'left'}
                              onChange={(e) => handleFieldChange(idx, 'alignment', e.target.value)}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!selectedTemplate.isSample && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Saving...' : 'Save Draft Layout'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              Select or upload a template to begin editing.
            </div>
          )}
        </div>
      </div>

      {/* Activation Modal */}
      {showActivateModal && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Activate Template for Issuance</h3>
                <p className="text-xs text-slate-500">
                  {selectedTemplate.name} (v{selectedTemplate.version})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Activating this template will make it the canonical template for all newly approved applications.
              Any candidate approved after activation will receive an offer letter generated from this PDF.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Checklist:</strong> Please ensure you have tested the "Preview PDF" and verified that candidate legal names, programme titles, and fees render neatly without clipping.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowActivateModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={activating}
                onClick={handleActivate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                {activating ? 'Activating...' : 'Confirm & Set Active'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
