import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BookOpen,
  Plus,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Clock,
  IndianRupee,
  Users,
  X
} from 'lucide-react';

const CATEGORIES = [
  'Development',
  'Programming',
  'AI & Data Science',
  'Design',
  'Business',
  'Engineering'
];

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals state
  const [editingProgram, setEditingProgram] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    category: 'Development',
    description: '',
    durationWeeks: '',
    feeInr: '',
    seats: '',
    startDate: '',
    endDate: '',
    syllabus: '',
    tasks: '',
    isActive: true
  });

  const fetchPrograms = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.adminGetPrograms();
      setPrograms(data.programs || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch programmes catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const openCreateModal = () => {
    setFormError('');
    setFormData({
      code: '',
      title: '',
      category: 'Development',
      description: '',
      durationWeeks: '',
      feeInr: '',
      seats: '',
      startDate: '',
      endDate: '',
      syllabus: '',
      tasks: '',
      isActive: true
    });
    setIsCreating(true);
  };

  const openEditModal = (p) => {
    setFormError('');
    setEditingProgram(p);
    setFormData({
      code: p.code,
      title: p.title || '',
      category: p.category || 'Development',
      description: p.description || '',
      durationWeeks: p.durationWeeks != null ? p.durationWeeks : '',
      feeInr: p.feeInr != null ? p.feeInr : '',
      seats: p.seats != null ? p.seats : '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      syllabus: Array.isArray(p.syllabus) ? p.syllabus.join('\n') : '',
      tasks: Array.isArray(p.tasks) ? p.tasks.join('\n') : '',
      isActive: p.isActive !== false
    });
  };

  const handleToggleActive = async (p) => {
    try {
      const updated = await api.adminUpdateProgram(p.code, { isActive: !p.isActive });
      setPrograms(prev => prev.map(item => item.code === p.code ? updated.program : item));
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleSaveProgram = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        durationWeeks: formData.durationWeeks !== '' ? Number(formData.durationWeeks) : null,
        feeInr: formData.feeInr !== '' ? Number(formData.feeInr) : null,
        seats: formData.seats !== '' ? Number(formData.seats) : null,
        startDate: formData.startDate ? formData.startDate : null,
        endDate: formData.endDate ? formData.endDate : null,
        syllabus: formData.syllabus.split('\n').map(s => s.trim()).filter(Boolean),
        tasks: formData.tasks.split('\n').map(t => t.trim()).filter(Boolean),
        isActive: formData.isActive
      };

      if (isCreating) {
        payload.code = formData.code.trim().toUpperCase();
        const res = await api.adminCreateProgram(payload);
        setPrograms(prev => [...prev, res.program]);
        setIsCreating(false);
      } else if (editingProgram) {
        const res = await api.adminUpdateProgram(editingProgram.code, payload);
        setPrograms(prev => prev.map(item => item.code === editingProgram.code ? res.program : item));
        setEditingProgram(null);
      }
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter programmes
  const filteredPrograms = programs.filter(p => {
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.code.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-600" />
            Programme Catalogue Manager
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage all 31 official tracks, configure curriculum, syllabus, tasks, and cohort details.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Add New Programme
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Categories ({programs.length})</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table / Content */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400">
          Loading programmes catalogue...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
          <p className="text-xs text-rose-700">{error}</p>
          <button
            onClick={fetchPrograms}
            className="inline-flex items-center gap-1 text-xs text-slate-800 font-semibold underline"
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Title & Category</th>
                  <th className="px-5 py-3.5">Content Status</th>
                  <th className="px-5 py-3.5">Fee / Duration</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPrograms.map(p => {
                  const hasSyllabus = Array.isArray(p.syllabus) && p.syllabus.length > 0;
                  const hasTasks = Array.isArray(p.tasks) && p.tasks.length > 0;

                  return (
                    <tr key={p.code} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {p.code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="font-bold text-slate-900">{p.title}</div>
                        <div className="text-[10px] text-slate-400">{p.category || 'Unassigned'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[11px]">
                        {hasSyllabus || hasTasks ? (
                          <div className="space-y-0.5">
                            {hasSyllabus && (
                              <span className="inline-block bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] mr-1">
                                {p.syllabus.length} Syllabus items
                              </span>
                            )}
                            {hasTasks && (
                              <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                                {p.tasks.length} Tasks
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unpublished</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-slate-600">
                        {p.feeInr != null ? `₹${p.feeInr}` : '—'} / {p.durationWeeks != null ? `${p.durationWeeks}w` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition ${
                            p.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {p.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ACTIVE
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              INACTIVE
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          Edit
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

      {/* Create / Edit Modal Dialog */}
      {(isCreating || editingProgram) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 sm:p-8 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {isCreating ? 'Create New Programme' : `Edit Programme: ${editingProgram?.code}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure programme details, syllabus, and evaluation tasks.
                </p>
              </div>
              <button
                onClick={() => { setIsCreating(false); setEditingProgram(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProgram} className="space-y-4 text-xs font-medium text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Programme Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isCreating}
                    placeholder="e.g. CYBER-OPS"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs uppercase disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {!isCreating && (
                    <span className="text-[10px] text-slate-400">Programme codes are permanent and immutable.</span>
                  )}
                </div>

                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                  Programme Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cybersecurity & Network Operations"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed track description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Duration (Weeks)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 8"
                    value={formData.durationWeeks}
                    onChange={(e) => setFormData({ ...formData, durationWeeks: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Review Fee (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 499"
                    value={formData.feeInr}
                    onChange={(e) => setFormData({ ...formData, feeInr: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={formData.seats}
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                  Syllabus (One topic per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Module 1: Architecture Overview&#10;Module 2: RESTful API Engineering&#10;Module 3: Production Hardening"
                  value={formData.syllabus}
                  onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                  Tasks (One deliverable per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Task 1: Design database schema and ER diagram&#10;Task 2: Build authenticated API endpoints&#10;Task 3: Deploy service with health check"
                  value={formData.tasks}
                  onChange={(e) => setFormData({ ...formData, tasks: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-slate-800 font-semibold cursor-pointer">
                  Track is Active and Accepting Applications
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setEditingProgram(null); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : (isCreating ? 'Create Programme' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
