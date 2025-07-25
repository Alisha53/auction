import axios from 'axios';
import { User, LoginForm, RegisterForm, ApiResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AuthResponse {
  user: User;
  token: string;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Login failed');
    }

    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Login failed');
  }
};

export const register = async (userData: RegisterForm): Promise<AuthResponse> => {
  try {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', userData);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Registration failed');
    }

    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Registration failed');
  }
};

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');

    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to get user data');
    }

    return response.data.data.user;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get user data');
  }
};

export const updateProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    const response = await api.put<ApiResponse<{ user: User }>>('/auth/profile', userData);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Profile update failed');
    }

    return response.data.data.user;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Profile update failed');
  }
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  try {
    const response = await api.put<ApiResponse<any>>('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmNewPassword: newPassword,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Password change failed');
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Password change failed');
  }
};

export const checkAvailability = async (
  type: 'username' | 'email',
  value: string
): Promise<boolean> => {
  try {
    const response = await api.get<ApiResponse<{ available: boolean }>>(
      `/auth/check-availability?type=${type}&value=${value}`
    );

    return response.data.data?.available || false;
  } catch (error) {
    return false;
  }
};

export default api;