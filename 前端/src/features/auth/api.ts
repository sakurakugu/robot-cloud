import { http } from '@/share/api/http';
import type {
  ApiResp,
  AuthPayload,
  AuthUser,
  LoginSession,
  UserCreatePayload,
  UserListQuery,
  UserListResult,
  UserUpdatePayload,
} from './types';

export function registerAccount(payload: { username: string; password: string }) {
  return http.post<ApiResp<AuthPayload>>('/api/v1/auth/register', payload, {
    headers: {
      'x-client-type': 'web',
      'x-device-name': navigator.userAgent,
    },
  })
}

export function loginAccount(payload: { username: string; password: string }) {
  return http.post<ApiResp<AuthPayload>>('/api/v1/auth/login', payload, {
    headers: {
      'x-client-type': 'web',
      'x-device-name': navigator.userAgent,
    },
  })
}

export function getProfile() {
  return http.get<ApiResp<AuthUser>>('/api/v1/auth/me')
}

export function logoutAccount() {
  return http.post<ApiResp<{ success: boolean }>>('/api/v1/auth/logout')
}

export function getMySessions() {
  return http.get<ApiResp<LoginSession[]>>('/api/v1/auth/sessions')
}

export function revokeSession(id: string) {
  return http.delete<ApiResp<{ success: boolean }>>(`/api/v1/auth/sessions/${id}`)
}

export function getUsers(query: UserListQuery) {
  return http.get<ApiResp<UserListResult>>('/api/v1/auth/users', {
    params: query,
  })
}

export function createUser(payload: UserCreatePayload) {
  return http.post<ApiResp<AuthUser>>('/api/v1/auth/users', payload)
}

export function updateUser(id: string, payload: UserUpdatePayload) {
  return http.patch<ApiResp<AuthUser>>(`/api/v1/auth/users/${id}`, payload)
}

export function resetUserPassword(id: string, password: string) {
  return http.patch<ApiResp<{ success: boolean }>>(`/api/v1/auth/users/${id}/password`, { password })
}

export function deleteUser(id: string) {
  return http.delete<ApiResp<{ success: boolean }>>(`/api/v1/auth/users/${id}`)
}

export function updateUserRole(id: string, role: 'user' | 'admin' | 'super_admin') {
  return http.put<ApiResp<AuthUser>>(`/api/v1/auth/users/${id}/role`, { role })
}
