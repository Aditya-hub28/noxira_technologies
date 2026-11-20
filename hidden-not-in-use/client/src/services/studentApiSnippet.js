// Extracted from client/src/services/api.js
// Student authentication API methods (deferred for current internship launch)

export const studentApiMethods = {
  studentSignup: (data) => request('/student/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  studentLogin: (data) => request('/student/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  studentLogout: () => request('/student/auth/logout', { method: 'POST' }),
  studentMe: () => request('/student/auth/me'),
  studentForgotPassword: (data) => request('/student/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  studentVerifyOtp: (data) => request('/student/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  studentResetPassword: (data) => request('/student/auth/reset-password', { method: 'POST', body: JSON.stringify(data) })
};

export const studentSignup = (data) => request('/student/auth/signup', { method: 'POST', body: JSON.stringify(data) });
export const studentLogin = (data) => request('/student/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const studentLogout = () => request('/student/auth/logout', { method: 'POST' });
export const studentMe = () => request('/student/auth/me');
export const studentForgotPassword = (data) => request('/student/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) });
export const studentVerifyOtp = (data) => request('/student/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) });
export const studentResetPassword = (data) => request('/student/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });
