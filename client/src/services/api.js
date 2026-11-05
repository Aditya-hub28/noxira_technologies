const BASE_URL = '/api/v1';

export async function request(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include',
    ...options
  };

  if (options.body instanceof FormData) {
    delete config.headers['Content-Type']; // Let browser set boundary
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'An error occurred during request');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),

  // Public Intake & Programs
  getPrograms: () => request('/programs'),
  getProgramDetail: (code) => request(`/programs/${encodeURIComponent(code)}`),
  submitApplication: (payload) => request('/intake/website-apply', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin Programs Management
  adminGetPrograms: () => request('/admin/programs'),
  adminCreateProgram: (payload) => request('/admin/programs', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateProgram: (code, payload) => request(`/admin/programs/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  
  // CSV Import Wizard
  previewCsv: (formData) => request('/intake/csv-preview', { method: 'POST', body: formData }),
  commitCsv: (payload) => request('/intake/csv-commit', { method: 'POST', body: JSON.stringify(payload) }),

  // Participants & Completion
  getParticipants: (params = '') => request(`/participants?${params}`),
  updateCompletion: (id, payload) => request(`/participants/${id}/completion`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Templates
  getTemplates: () => request('/templates'),
  uploadBackground: (formData) => request('/templates/upload-background', { method: 'POST', body: formData }),
  saveTemplateLayout: (payload) => request('/templates/save-layout', { method: 'POST', body: JSON.stringify(payload) }),
  resetTemplateBorder: () => request('/templates/reset-border', { method: 'POST' }),
  renderPreview: (payload) => fetch(`${BASE_URL}/templates/preview-render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include'
  }),

  // Certificates & Issuance
  getCertificates: (params = '') => request(`/certificates?${params}`),
  issueBatch: (payload) => request('/certificates/issue-batch', { method: 'POST', body: JSON.stringify(payload) }),
  revokeCertificate: (id, payload) => request(`/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify(payload) }),
  replaceCertificate: (id, payload) => request(`/certificates/${id}/replace`, { method: 'POST', body: JSON.stringify(payload) }),

  // Public Verification
  verifyToken: (token) => request(`/public/verify/${token}`),

  // Distribution
  listDeliveryJobs: (params = '') => request(`/distribution/jobs?${params}`),
  queueEmailBatch: (payload) => request('/distribution/queue-batch', { method: 'POST', body: JSON.stringify(payload) }),
  retryDelivery: (id) => request(`/distribution/retry/${id}`, { method: 'POST' }),
  reconcileDelivery: (id, payload) => request(`/distribution/jobs/${id}/reconcile`, { method: 'POST', body: JSON.stringify(payload) }),

  // Audit
  getAuditLogs: (params = '') => request(`/audit?${params}`)
};
