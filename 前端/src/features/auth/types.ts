export type AccountRole = 'user' | 'admin' | 'super_admin'

export interface AuthUser {
  id: string
  username: string
  nickname: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  isActive: boolean
  role: AccountRole
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface LoginSession {
  id: string
  clientType: 'web' | 'mobile' | 'unknown'
  deviceName: string
  ipAddress: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export interface AuthPayload {
  token: string
  user: AuthUser
  session: LoginSession
}

export interface ApiResp<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}

export interface UserListResult {
  items: AuthUser[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface UserListQuery {
  page: number
  page_size: number
  keyword?: string
  role?: string
  is_active?: boolean
}

export interface UserCreatePayload {
  username: string
  nickname: string | null
  email: string
  password: string
  role: AccountRole
  is_active: boolean
  bio: string | null
  avatar_url: string | null
}

export interface UserUpdatePayload {
  username: string
  nickname: string | null
  email: string
  role: AccountRole
  is_active: boolean
  bio: string | null
  avatar_url: string | null
}
