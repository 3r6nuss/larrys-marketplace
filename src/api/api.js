const API_BASE = '/api';

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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `API-Fehler: ${response.status}`);
  }

  return response.json();
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
  const params = new URLSearchParams();
  if (filters.seller) params.set('seller', filters.seller);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.status) params.set('status', filters.status);

  const query = params.toString();
  return apiFetch(`/cars${query ? `?${query}` : ''}`);
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
  return apiFetch(`/cars/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateCarStatus(id, status) {
  return apiFetch(`/cars/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function deleteCar(id) {
  return apiFetch(`/cars/${id}`, {
    method: 'DELETE',
  });
}

// ─── Employees ───────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  return apiFetch('/employees');
}

export async function createEmployee(data) {
  return apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployee(id, data) {
  return apiFetch(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(id) {
  return apiFetch(`/employees/${id}`, {
    method: 'DELETE',
  });
}

export async function setDefaultEmployee(id) {
  return apiFetch(`/employees/${id}/default`, {
    method: 'PUT',
  });
}
