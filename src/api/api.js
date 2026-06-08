const API_BASE = '/api';

function jsonRequest(method, data) {
 return {
 method,
 body: JSON.stringify(data),
 };
}

function methodOnlyRequest(method) {
 return { method };
}

function buildQuery(filters, keys) {
 const params = new URLSearchParams();
 keys.forEach((key) => {
 if (filters[key]) params.set(key, filters[key]);
 });
 const query = params.toString();
 return query ? `?${query}` : '';
}

async function parseResponseData(response) {
 if (response.status === 204) return null;

 const contentType = response.headers.get('content-type') || '';
 if (contentType.includes('application/json')) {
 return response.json();
 }

 const text = await response.text();
 return text || null;
}

/**
 * Get the stored auth token from localStorage.
 */
function getToken() {
 return localStorage.getItem('larrys_token');
}

/**
 * Set the auth token in localStorage.
 */
export function setToken(token) {
 localStorage.setItem('larrys_token', token);
}

/**
 * Remove the auth token from localStorage.
 */
export function clearToken() {
 localStorage.removeItem('larrys_token');
}

/**
 * Base fetch wrapper with auth header and error handling.
 */
async function apiFetch(endpoint, options = {}) {
 const token = getToken();
 const headers = {
 ...options.headers,
 };

 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // Don't set Content-Type for FormData (browser sets it with boundary)
 if (!(options.body instanceof FormData)) {
 headers['Content-Type'] = 'application/json';
 }

 const response = await fetch(`${API_BASE}${endpoint}`, {
 ...options,
 headers,
 });

 if (response.status === 401) {
 clearToken();
 window.location.reload();
 throw new Error('Nicht autorisiert');
 }

 if (!response.ok) {
 const data = await parseResponseData(response).catch(() => null);
 const message =
 typeof data === 'object' && data !== null && 'error' in data
 ? data.error
 : null;
 throw new Error(message || `API-Fehler: ${response.status}`);
 }

 return parseResponseData(response);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function verifyToken(token) {
 const res = await fetch(`${API_BASE}/auth/verify`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token }),
 });
 return res.json();
}

// ─── Cars ────────────────────────────────────────────────────────────────────

export async function fetchCars(filters = {}) {
 const query = buildQuery(filters, ['seller', 'category', 'sort', 'status']);
 return apiFetch(`/cars${query}`);
}

export async function fetchCar(id) {
 return apiFetch(`/cars/${id}`);
}

export async function createCar(formData) {
 return apiFetch('/cars', {
 method: 'POST',
 body: formData, // FormData for multipart upload
 });
}

export async function updateCar(id, data) {
 if (data instanceof FormData) {
 return apiFetch(`/cars/${id}`, {
 method: 'PUT',
 body: data,
 });
 }
 return apiFetch(`/cars/${id}`, jsonRequest('PUT', data));
}

export async function updateCarStatus(id, status) {
 return apiFetch(`/cars/${id}/status`, jsonRequest('PUT', { status }));
}

export async function deleteCar(id) {
 return apiFetch(`/cars/${id}`, methodOnlyRequest('DELETE'));
}

// ─── Employees ───────────────────────────────────────────────────────────────

export async function fetchEmployees() {
 return apiFetch('/employees');
}

export async function createEmployee(data) {
 return apiFetch('/employees', jsonRequest('POST', data));
}

export async function updateEmployee(id, data) {
 return apiFetch(`/employees/${id}`, jsonRequest('PUT', data));
}

export async function deleteEmployee(id) {
 return apiFetch(`/employees/${id}`, methodOnlyRequest('DELETE'));
}

export async function setDefaultEmployee(id) {
 return apiFetch(`/employees/${id}/default`, methodOnlyRequest('PUT'));
}
