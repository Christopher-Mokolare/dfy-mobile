import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { clearAccessToken, getAccessToken, setAccessToken } from '../core/tokenStorage'
import type { AuthResponse, GoogleRegisterModel, User } from '../types'
import { authApi } from '../api'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string, secondFactorCode?: string) => Promise<void>
  googleLogin: (idToken: string, secondFactorCode?: string) => Promise<void>
  googleRegister: (data: GoogleRegisterModel) => Promise<void>
  logout: () => void
  refreshUser: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isProfileComplete: () => boolean
  isProfileIncomplete: () => boolean
  canPostErrands: () => boolean
  canAcceptTasks: () => boolean
  getProfileCompletion: () => number
}

function isAdminProfile(candidate: any): boolean {
  if (!candidate || typeof candidate !== 'object') return false
  if (candidate.isAdmin === true) return true
  const roles: unknown[] = [
    candidate.role,
    candidate.userType,
    ...(Array.isArray(candidate.roles) ? candidate.roles : []),
  ]
  return roles.some(role => String(role ?? '').trim().toLowerCase().includes('admin'))
}

function isAdminSession(candidate: any, accessToken?: string | null): boolean {
  if (isAdminProfile(candidate)) return true
  if (!accessToken) return false
  try {
    const encoded = accessToken.split('.')[1]
    if (!encoded) return false
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const decoded = atob(padded)
    const payloadText = decodeURIComponent(Array.from(decoded, char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
    const claims = JSON.parse(payloadText)
    const claimRoles = [
      claims.role,
      claims.roles,
      claims.userType,
      claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
    ]
    return claims.isAdmin === true || claimRoles.some(value =>
      (Array.isArray(value) ? value : [value])
        .some(role => String(role ?? '').trim().toLowerCase().includes('admin'))
    )
  } catch {
    return false
  }
}

const ADMIN_MOBILE_MESSAGE =
  'Admin accounts use the DoForYou web admin console and cannot sign in to the mobile app.'

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const storedToken = await getAccessToken()
      const storedUser = await AsyncStorage.getItem('currentUser')
      if (storedToken && storedUser) {
        try {
          const parsedRaw = JSON.parse(storedUser)
          const { idNumber: _legacyIdNumber, ...parsed } = parsedRaw
          if (_legacyIdNumber !== undefined) await AsyncStorage.setItem('currentUser', JSON.stringify(parsed))
          if (isAdminSession(parsed, storedToken)) {
            // Mobile is a creator/runner client; stale admin sessions are cleared.
            await clearAccessToken()
            await AsyncStorage.multiRemove(['currentUser', 'refreshToken', 'userPreferences'])
          } else {
            setToken(storedToken)
            setUser(parsed)
          }
          if (!isAdminSession(parsed, storedToken) && (!parsed.idNumber || !parsed.address)) {
            void authApi.getProfile()
              .then(async r => {
                const d = r.data?.data || r.data
                if (d) {
                  const { idNumber: _legacyIdNumber, ...safeProfile } = d as any
                  const merged = { ...parsed, ...safeProfile }
                  await AsyncStorage.setItem('currentUser', JSON.stringify(merged))
                  await AsyncStorage.setItem('userPreferences', JSON.stringify({
                    canCreateTasks: merged.canCreateTasks === true,
                    canAcceptTasks: merged.canAcceptTasks === true,
                  }))
                  setUser(merged)
                }
              })
              .catch(() => {})
          }
        } catch {
          await clearAccessToken()
          await AsyncStorage.removeItem('currentUser')
        }
      } else if (!storedToken) {
        await AsyncStorage.multiRemove(['currentUser', 'refreshToken'])
      }
      setLoading(false)
    }
    init()
  }, [])

  const acceptAuthResponse = useCallback(async (data: AuthResponse) => {
    if (!data.success || !data.token || !data.user) {
      const error: any = new Error(data.message || 'Sign-in failed')
      error.response = { data }
      throw error
    }
    if (isAdminSession(data.user, data.token)) {
      await clearAccessToken()
      await AsyncStorage.multiRemove(['currentUser', 'refreshToken', 'userPreferences'])
      setToken(null)
      setUser(null)
      throw new Error(ADMIN_MOBILE_MESSAGE)
    }
    await setAccessToken(data.token)
    let fullUser = data.user
    try {
      const profileRes = await authApi.getProfile()
      const profileData = profileRes.data?.data || profileRes.data
      if (profileData) fullUser = { ...data.user, ...profileData }
    } catch {
      // Auth response remains authoritative when profile refresh is temporarily unavailable.
    }
    if (isAdminSession(fullUser, data.token)) {
      await clearAccessToken()
      await AsyncStorage.multiRemove(['currentUser', 'refreshToken', 'userPreferences'])
      setToken(null)
      setUser(null)
      throw new Error(ADMIN_MOBILE_MESSAGE)
    }
    // Never cache full ID data in ordinary app storage.
    const { idNumber: _legacyIdNumber, ...safeUser } = fullUser as any
    setToken(data.token)
    await AsyncStorage.setItem('currentUser', JSON.stringify(safeUser))
    // Cached preferences mirror the backend capability response. UserType is a
    // preference only and must never be used locally to grant creator/runner access.
    const prefs = {
      canCreateTasks: safeUser.canCreateTasks === true,
      canAcceptTasks: safeUser.canAcceptTasks === true,
    }
    await AsyncStorage.setItem('userPreferences', JSON.stringify(prefs))
    setUser(safeUser as User)
  }, [])

  const login = useCallback(async (email: string, password: string, secondFactorCode?: string) => {
    try {
      const res = await authApi.login({ email, password, secondFactorCode })
      await acceptAuthResponse(res.data)
    } catch (error: any) {
      if (error.response?.data) throw error
      throw error
    }
  }, [acceptAuthResponse])

  const googleLogin = useCallback(async (idToken: string, secondFactorCode?: string) => {
    const response = await authApi.googleLogin(idToken, secondFactorCode)
    await acceptAuthResponse(response.data)
  }, [acceptAuthResponse])

  const googleRegister = useCallback(async (data: GoogleRegisterModel) => {
    const response = await authApi.googleRegister(data)
    await acceptAuthResponse(response.data)
  }, [acceptAuthResponse])


  const logout = useCallback(async () => {
    const existingToken = await getAccessToken()
    // Best-effort server revocation is sent with an explicit header before the
    // local token is cleared. Local sign-out must still work offline.
    if (existingToken) void authApi.logout(existingToken).catch(() => undefined)
    await clearAccessToken()
    await AsyncStorage.multiRemove(['currentUser', 'refreshToken', 'userPreferences'])
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getProfile()
      const fresh = response.data?.data || response.data
      if (fresh && typeof fresh === 'object') {
        const stored = await AsyncStorage.getItem('currentUser')
        const previous = stored ? JSON.parse(stored) : {}
        const merged = { ...previous, ...fresh }
        await AsyncStorage.setItem('currentUser', JSON.stringify(merged))
        setUser(merged)
        return
      }
    } catch {}
    const stored = await AsyncStorage.getItem('currentUser')
    if (stored) { try { setUser(JSON.parse(stored)) } catch {} }
  }, [])

  const isAuthenticated = useCallback(() => {
    if (!token) return false
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4)
      const decoded = atob(padded)
      const payloadText = decodeURIComponent(Array.from(decoded, char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
      const payload = JSON.parse(payloadText)
      return payload.exp > Date.now() / 1000
    } catch { return false } // malformed/unreadable tokens fail closed; the API remains authoritative
  }, [token])

  const isAdmin = useCallback(() => isAdminSession(user, token), [user, token])

  const isProfileComplete = useCallback(() => {
    if (!user) return false
    const phone = user.contact || user.phoneNumber
    if (typeof user.profileCompleted === 'boolean') return user.profileCompleted
    if (typeof user.profileCompletion === 'number') return user.profileCompletion >= 100
    return !!(user.firstName && user.lastName && user.email && phone
      && user.userType)
  }, [user])

  const isProfileIncomplete = useCallback(() => !isProfileComplete(), [isProfileComplete])

  const canPostErrands = useCallback(() => {
    if (!isAuthenticated() || isAdmin()) return false
    if (user?.emailVerified === false) return false
    if (typeof user?.canCreateTasks === 'boolean') return user.canCreateTasks
    const ut = user?.userType
    if (ut) return ut === 'creator' || ut === 'both'
    return false
  }, [user, isAuthenticated, isAdmin])

  const canAcceptTasks = useCallback(() => {
    if (!isAuthenticated() || isAdmin()) return false
    if (typeof user?.canAcceptTasks === 'boolean') return user.canAcceptTasks
    return false
  }, [user, isAuthenticated, isAdmin])

  const getProfileCompletion = useCallback(() => user?.profileCompletion ?? 0, [user])

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, googleLogin, googleRegister, logout, refreshUser,
      isAuthenticated, isAdmin,
      isProfileComplete, isProfileIncomplete,
      canPostErrands, canAcceptTasks,
      getProfileCompletion,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
