const API = '/api/v1';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.errors?.[0]?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  verifyOtp: (body) => request('/auth/verify-otp', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),

  // Student
  studentDashboard: () => request('/student/dashboard'),
  submitPoll: (body) => request('/student/poll', { method: 'POST', body }),
  initiatePayment: () => request('/student/payment/initiate', { method: 'POST' }),
  studentHistory: (page = 1) => request(`/student/history?page=${page}`),

  // Manager
  upcomingMeal: () => request('/manager/dashboard/upcoming-meal'),
  aiPredict: (menuId) => request(`/manager/ai/predict?menu_id=${menuId}`),
  activeTokens: (search = '') => request(`/manager/tokens/active?search=${search}`),
  redeemToken: (token_code) => request('/manager/tokens/redeem', { method: 'PUT', body: { token_code } }),
  defaulters: () => request('/manager/defaulters'),
  remindDefaulters: (student_ids) => request('/manager/defaulters/remind', { method: 'POST', body: { student_ids } }),
  getMenus: (date) => request(`/manager/menus${date ? `?date=${date}` : ''}`),
  createMenu: (body) => request('/manager/menus', { method: 'POST', body }),
  updateMenu: (id, body) => request(`/manager/menus/${id}`, { method: 'PUT', body }),
  deleteMenu: (id) => request(`/manager/menus/${id}`, { method: 'DELETE' }),
  recordAttendance: (body) => request('/manager/attendance/record', { method: 'POST', body }),
};
