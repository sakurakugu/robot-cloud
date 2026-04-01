import { http } from '@/share/api/http';
import type {
  ApiResp,
  AuthPayload,
  RegisterConfig,
  RegisterResult,
  AuthUser,
  LoginSession,
  UserCreatePayload,
  UserListQuery,
  UserListResult,
  RegistrationApprovalStatus,
  UserUpdatePayload,
} from './types';

export function registerAccount(payload: { username: string; password: string }) {
  return http.post<ApiResp<RegisterResult>>('/api/v1/auth/register', payload, {
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

export function getRegisterConfig() {
  return http.get<ApiResp<RegisterConfig>>('/api/v1/auth/register-config')
}

export function updateRegisterConfig(payload: Partial<RegisterConfig>) {
  return http.put<ApiResp<RegisterConfig>>('/api/v1/auth/register-config', payload)
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

export function updateUserApproval(id: string, approvalStatus: RegistrationApprovalStatus) {
  return http.patch<ApiResp<AuthUser>>(`/api/v1/auth/users/${id}/approval`, {
    approval_status: approvalStatus,
  })
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
