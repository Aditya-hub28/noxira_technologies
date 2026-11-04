import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Download, Sliders, Upload, Sparkles, QrCode, Check, RefreshCw, Layers, Image as ImageIcon } from 'lucide-react';

export default function TemplatePreviewPage() {
  const [template, setTemplate] = useState(null);
  const [useCustomBg, setUseCustomBg] = useState(false);
  const [bgPreviewUrl, setBgPreviewUrl] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Editable sample data
  const [sampleName, setSampleName] = useState('Dr. Christopher Bartholomew Montgomery-Fitzgerald');
  const [sampleProgram, setSampleProgram] = useState('Advanced Distributed Systems & Cloud Architecture');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-01'); // same day test
  const [signatoryName, setSignatoryName] = useState('Aditya Jha');
  const [signatoryTitle, setSignatoryTitle] = useState('Managing Director & Lead Architect');

  // Sliders for dynamic positioning (in PDF points, height = 595, width = 842)
  const [layout, setLayout] = useState({
    name: { y: 395, fontSize: 34, color: '#0F172A' },
    program: { y: 320, fontSize: 20, color: '#D97706' },
    date: { y: 287, fontSize: 11, color: '#334155' },
    qr: { x: 382, y: 55, size: 78 },
    certId: { x: 60, y: 110, fontSize: 10, color: '#0F172A' },
    signatory: { x: 600, y: 90, color: '#0F172A' }
  });

  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch initial template settings
  useEffect(() => {
    api.getTemplates()
      .then(res => {
        if (res.template) {
          setTemplate(res.template);
          if (res.template.layout) {
            setLayout(prev => ({ ...prev, ...res.template.layout }));
          }
          if (res.template.useCustomBackground) {
            setUseCustomBg(true);
          }
          if (res.template.signatory) {
            setSignatoryName(res.template.signatory.name || 'Aditya Jha');
            setSignatoryTitle(res.template.signatory.title || 'Managing Director & Lead Architect');
          }
        }
      })
      .catch(err => console.error('Failed to load template:', err));
  }, []);

  const handleUploadBg = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // Local thumbnail preview
    const objectUrl = URL.createObjectURL(file);
    setBgPreviewUrl(objectUrl);
    setUseCustomBg(true);

    setUploadingBg(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('bgImage', file);
      const res = await api.uploadBackground(formData);
      setTemplate(res.template);
      setMessage('Custom background design uploaded & activated!');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingBg(false);
    }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.saveTemplateLayout({
        layout,
        signatory: { name: signatoryName, title: signatoryTitle },
        useCustomBackground: useCustomBg
      });
      setMessage('Template design & layout coordinates saved for all future certificates!');
    } catch (err) {
      alert('Failed to save layout: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToVector = async () => {
    try {
      await api.resetTemplateBorder();
      setUseCustomBg(false);
      setBgPreviewUrl(null);
      setMessage('Reset to official NOXIRA luxury vector border template.');
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  const handleDownloadTestPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.renderPreview({
        recipientName: sampleName,
        programTitle: sampleProgram,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        signatoryName,
        signatoryTitle,
        customLayout: layout,
        useCustomBackground: useCustomBg
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NOXIRA-LIVE-TEMPLATE-TEST.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to render PDF: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Convert PDF coordinate Y (0 at bottom) to CSS Top % for live canvas preview
  const pdfYToCssTopPercent = (pdfY) => {
    const totalHeight = 595.28;
    return `${((totalHeight - pdfY) / totalHeight) * 100}%`;
  };

  const pdfXToCssLeftPercent = (pdfX) => {
    const totalWidth = 841.89;
    return `${(pdfX / totalWidth) * 100}%`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Certificate Design Studio & Template Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload custom Canva/Figma backgrounds, adjust dynamic element coordinates, or switch between vector designs anytime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTestPdf}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-400" />
            {downloading ? 'Rendering...' : 'Download Live Test PDF'}
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save As Active Template'}
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Main Grid: Controls + Live Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          {/* Section 1: Background Template Mode */}
          <div className="space-y-3 border-b border-slate-100 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>1. Certificate Background Design</span>
              {useCustomBg && (
                <button
                  onClick={handleResetToVector}
                  className="text-[10px] text-rose-600 hover:underline font-semibold"
                >
                  Reset to Vector Border
                </button>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseCustomBg(false)}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition ${
                  !useCustomBg
                    ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>NOXIRA Luxury Vector</span>
              </button>

              <label
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                  useCustomBg
                    ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-4 h-4 text-amber-600" />
                <span>{uploadingBg ? 'Uploading...' : 'Upload Canva / Figma'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleUploadBg}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-400">
              Tip: Export a blank A4 Landscape (842 x 595 px) PNG or JPG from Canva/Figma without text.
            </p>
          </div>

          {/* Section 2: Position & Coordinates Adjuster */}
          <div className="space-y-4 border-b border-slate-100 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>2. Visual Alignment & Positions</span>
            </h3>

            {/* Recipient Name Y Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-700 font-semibold mb-1">
                <span>Student Name Vertical Position (Y)</span>
                <span className="font-mono text-amber-600">{layout.name.y} pt</span>
              </div>
              <input
                type="range"
                min="200"
                max="500"
                value={layout.name.y}
                onChange={(e) => setLayout({ ...layout, name: { ...layout.name, y: parseInt(e.target.value) } })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Program Title Y Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-700 font-semibold mb-1">
                <span>Program Title Vertical Position (Y)</span>
                <span className="font-mono text-amber-600">{layout.program.y} pt</span>
              </div>
              <input
                type="range"
                min="150"
                max="450"
                value={layout.program.y}
                onChange={(e) => setLayout({ ...layout, program: { ...layout.program, y: parseInt(e.target.value) } })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            {/* QR Code Position & Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-semibold mb-1">
                  <span>QR Code X (Left)</span>
                  <span className="font-mono text-amber-600">{layout.qr.x} pt</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="700"
                  value={layout.qr.x}
                  onChange={(e) => setLayout({ ...layout, qr: { ...layout.qr, x: parseInt(e.target.value) } })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-semibold mb-1">
                  <span>QR Code Y (Bottom)</span>
                  <span className="font-mono text-amber-600">{layout.qr.y} pt</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="300"
                  value={layout.qr.y}
                  onChange={(e) => setLayout({ ...layout, qr: { ...layout.qr, y: parseInt(e.target.value) } })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Student Name Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layout.name.color || '#0F172A'}
                    onChange={(e) => setLayout({ ...layout, name: { ...layout.name, color: e.target.value } })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-600">{layout.name.color}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Program Title Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={layout.program.color || '#D97706'}
                    onChange={(e) => setLayout({ ...layout, program: { ...layout.program, color: e.target.value } })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-600">{layout.program.color}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Sample Text Simulation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              3. Sample Test Values (Live Preview)
            </h3>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Sample Name</label>
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Sample Program</label>
              <input
                type="text"
                value={sampleProgram}
                onChange={(e) => setSampleProgram(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Live Canvas Column (7 cols) */}
        <div className="lg:col-span-7 bg-slate-200/80 p-5 rounded-2xl flex flex-col items-center justify-center">
          <div className="w-full max-w-xl aspect-[1.414/1] bg-white rounded-lg shadow-xl relative overflow-hidden border border-slate-300 select-none">
            {/* Custom Uploaded Background Image */}
            {useCustomBg && (bgPreviewUrl || template?.backgroundAssetPath) && (
              <img
                src={bgPreviewUrl || '/api/placeholder/842/595'}
                alt="Custom Certificate Background"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            )}

            {/* Fallback Vector Luxury Border */}
            {!useCustomBg && (
              <>
                <div className="absolute inset-2 border-2 border-slate-900 pointer-events-none"></div>
                <div className="absolute inset-3 border border-amber-500 pointer-events-none"></div>
                <div className="text-center pt-5">
                  <div className="inline-block bg-amber-50 border border-amber-200 px-3 py-0.5 rounded text-[10px] font-bold text-amber-800">
                    NOXIRA TECHNOLOGIES
                  </div>
                  <h2 className="text-base font-serif font-bold text-slate-900 mt-1">
                    CERTIFICATE OF ACHIEVEMENT
                  </h2>
                  <p className="text-[10px] italic text-slate-500 mt-1">This is proudly presented to</p>
                </div>
              </>
            )}

            {/* Dynamic Recipient Name (Positioned via Slider Y) */}
            <div
              style={{
                top: pdfYToCssTopPercent(layout.name.y),
                color: layout.name.color
              }}
              className="absolute left-0 right-0 text-center px-6 transition-all"
            >
              <h3 className="text-lg font-serif font-black underline decoration-amber-500 decoration-1 underline-offset-4 truncate">
                {sampleName || 'Recipient Name'}
              </h3>
            </div>

            {/* Dynamic Program Title (Positioned via Slider Y) */}
            <div
              style={{
                top: pdfYToCssTopPercent(layout.program.y),
                color: layout.program.color
              }}
              className="absolute left-0 right-0 text-center px-8 transition-all"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider truncate">
                {sampleProgram || 'Program Title'}
              </h4>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Program Duration: {startDate} to {endDate}
              </p>
            </div>

            {/* Dynamic Verification QR Code (Positioned via Sliders X & Y) */}
            <div
              style={{
                left: pdfXToCssLeftPercent(layout.qr.x),
                bottom: `${(layout.qr.y / 595.28) * 100}%`,
                width: `${(layout.qr.size / 841.89) * 100}%`
              }}
              className="absolute text-center transition-all"
            >
              <div className="bg-white p-1 rounded border border-amber-500 shadow-xs">
                <QrCode className="w-full h-auto text-slate-900" />
              </div>
              <span className="text-[7px] font-bold text-slate-700 block mt-0.5">VERIFY QR</span>
            </div>

            {/* Certificate ID */}
            <div
              style={{
                left: pdfXToCssLeftPercent(layout.certId.x),
                bottom: `${(layout.certId.y / 595.28) * 100}%`
              }}
              className="absolute text-[8px] font-mono font-bold text-slate-800"
            >
              <div>ID: NOX-2026-LIVE-0001</div>
              <div className="text-slate-400 text-[7px]">Issued: {new Date().toLocaleDateString()}</div>
            </div>

            {/* Signatory */}
            <div
              style={{
                right: '4%',
                bottom: `${(layout.signatory.y / 595.28) * 100}%`
              }}
              className="absolute text-right text-[8px]"
            >
              <div className="w-20 border-b border-slate-700 pb-0.5 mb-0.5 font-serif italic text-slate-700">
                Aditya Jha
              </div>
              <div className="font-bold text-slate-900">{signatoryName}</div>
              <div className="text-[7px] text-slate-500">{signatoryTitle}</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 text-center">
            Canvas updates live as you drag sliders. Click <strong>"Save As Active Template"</strong> to apply to all future certificate issuances.
          </p>
        </div>
      </div>
    </div>
  );
}
