import api from './client'
import type { LoginModel, RegisterModel, AuthResponse } from '../types'
import type { BackendTaskPage, BackendClaimTaskRequest, BackendBooleanResponse, BackendCreateTaskRequest, BackendUpdateTaskRequest } from './contract'

export interface TaskBudgetLimits { minimumBudget: number; maximumBudget: number; currency: string }
interface ApiResponse<T> { success?: boolean; data?: T; message?: string | null }

export const taskConfigurationApi = {
  getTaskLimits: () => api.get<ApiResponse<TaskBudgetLimits>>('/config/task-limits'),
}

export const publicApi = {
  getStats: () => api.get('/public/stats'),
}

export const identityVerificationApi = {
  getStatus: () => api.get('/identity-verification/status'),
  createSession: (data: { consentAccepted: boolean; consentVersion: string }) => api.post('/identity-verification/session', data),
  exchange: (handoffCode: string) => api.post('/identity-verification/exchange', { handoffCode }),
}

export const authApi = {
  login: (data: LoginModel) => api.post<AuthResponse>('/auth/login', data),
  googleLogin: (idToken: string, secondFactorCode?: string) => api.post<AuthResponse>('/auth/google', { idToken, secondFactorCode }),
  googleRegister: (data: import('../types').GoogleRegisterModel) => api.post<AuthResponse>('/auth/google/register', data),
  linkGoogleAccount: (idToken: string, stepUpToken: string) => api.post('/auth/google/link', { idToken }, { headers: { 'X-DFY-Step-Up-Token': stepUpToken } }),
  getTwoFactorStatus: () => api.get('/auth/two-factor/status'),
  setupTwoFactor: (data: { currentPassword?: string; googleIdToken?: string }) => api.post('/auth/two-factor/setup', data),
  confirmTwoFactor: (code: string) => api.post('/auth/two-factor/confirm', { code }),
  disableTwoFactor: (data: { currentPassword?: string; code: string }) => api.post('/auth/two-factor/disable', data),
  cancelTwoFactorSetup: () => api.post('/auth/two-factor/cancel-setup', {}),
  reauthenticate: (data: { currentPassword?: string; googleIdToken?: string; secondFactorCode?: string }) => api.post('/auth/reauthenticate', data),
  logout: (token?: string) => api.post('/auth/logout', {}, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
  register: (data: RegisterModel) => api.post<AuthResponse>('/auth/register', data),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: (email: string) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => api.post('/auth/reset-password', { token, newPassword }),
  changePassword: (data: object) => api.post('/auth/change-password', data),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: object) => api.put('/user/profile', data),
  updateMarketingConsent: (enabled: boolean) => api.put('/user/marketing-consent', { enabled }),
  validateId: (idNumber: string) => api.post('/user/validate-id', { idNumber }),
}

export const tasksApi = {
  getAvailable: (page = 1, pageSize = 10, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...filters })
    return api.get<BackendTaskPage>(`/tasks/available?${params}`)
  },
  getMyPosted: () => api.get('/tasks/my-posted'),
  getMyActive: () => api.get('/tasks/my-active'),
  getMyCompleted: () => api.get('/tasks/my-completed'),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: BackendCreateTaskRequest) => api.post('/tasks', data),
  update: (id: string, data: BackendUpdateTaskRequest) => api.put(`/tasks/${id}`, data),
  claim: (id: string, helperName: string, helperContact: string, termsAccepted = false) =>
    api.post<BackendBooleanResponse>(`/tasks/${id}/claim`, { helperName, helperContact, termsAccepted } satisfies BackendClaimTaskRequest),
  complete: (id: string) => api.post<BackendBooleanResponse>(`/tasks/${id}/complete`, {}),
  confirm: (id: string) => api.post<BackendBooleanResponse>(`/tasks/${id}/confirm`, {}),
  cancel: (id: string, reason: string) => api.post(`/tasks/${id}/cancel`, { reason }),
  getMessages: (id: string, params?: object) => api.get(`/tasks/${id}/messages`, { params }),
  sendMessage: (id: string, content: string) => api.post(`/tasks/${id}/messages`, { content }),
  markMessagesRead: (id: string) => api.put(`/tasks/${id}/messages/read`, {}),
  addProgress: (id: string, message: string) => api.post(`/tasks/${id}/progress`, { progressNote: message }),
  getDashboardStats: () => api.get('/tasks/dashboard/stats'),
  getRecentActivity: (limit = 5) => api.get(`/tasks/dashboard/activity?limit=${limit}`),
  getPaymentHistory: () => api.get('/tasks/payment-history'),
  getPaymentUrl: (id: string) => api.get(`/tasks/${id}/payment-url`),
  getFilters: () => api.get('/tasks/filters'),
}

export const bankingApi = {
  getBankAccounts: () => api.get('/banking/accounts'),
  getBanks: () => api.get('/banking/banks'),
  addBankAccount: (data: object, stepUpToken?: string) => api.post('/banking/accounts', data, stepUpToken ? { headers: { 'X-DFY-Step-Up-Token': stepUpToken } } : undefined),
  verifyBankAccount: (id: number, stepUpToken?: string) => api.post(`/banking/bank-accounts/${id}/verify`, {}, stepUpToken ? { headers: { 'X-DFY-Step-Up-Token': stepUpToken } } : undefined),
  setDefaultPayoutAccount: (id: number, stepUpToken?: string) => api.put(`/banking/bank-accounts/${id}/default`, {}, stepUpToken ? { headers: { 'X-DFY-Step-Up-Token': stepUpToken } } : undefined),
  retryVerification: (id: number, stepUpToken?: string) => api.post(`/banking/bank-accounts/${id}/verify`, {}, stepUpToken ? { headers: { 'X-DFY-Step-Up-Token': stepUpToken } } : undefined),
  removeBankAccount: (id: number, stepUpToken?: string) => api.delete(`/banking/bank-accounts/${id}`, stepUpToken ? { headers: { 'X-DFY-Step-Up-Token': stepUpToken } } : undefined),
}

export const messagesApi = {
  getConversations: () => api.get('/messages/conversations'),
}

export const supportApi = {
  createTicket: (data: object) => api.post('/support/tickets', data),
  getMyTickets: () => api.get('/support/tickets'),
  getTicket: (id: number) => api.get(`/support/tickets/${id}`),
}

export const notificationsApi = {
  getUnreadCount: () => api.get('/notifications/unread-count'),
  getAll: (page = 1, pageSize = 20, type?: string, unreadOnly?: boolean) => {
    const params: any = { page, pageSize }
    if (type) params.type = type
    if (unreadOnly) params.unreadOnly = true
    return api.get('/notifications', { params })
  },
  markRead: (id: string) => api.post(`/notifications/${id}/mark-read`, {}),
  markAllRead: () => api.post('/notifications/mark-all-read', {}),
  markTaskRead: (taskId: number) => api.post('/notifications/mark-task-read', { taskId }),
  remove: (id: string) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications/clear-read'),
}

export const taskIncidentsApi = {
  report: (taskId: string, data: { category: string; description: string; evidenceMessageIds?: number[] }) =>
    api.post(`/tasks/${encodeURIComponent(taskId)}/incidents`, data),
  getMine: () => api.get('/incidents/my'),
}

export const disputesApi = {
  raise: (taskId: string, issue: string, category: string) => api.post('/disputes', { taskId, issue, category }),
  getMy: () => api.get('/disputes/my'),
}

export const ratingsApi = {
  submit: (taskId: string, ratingValue: number, review?: string) => api.post('/ratings', { taskId, ratingValue, review }),
  getForUser: (userId: number, page = 1, pageSize = 5) => api.get(`/ratings/user/${userId}?page=${page}&pageSize=${pageSize}`),
  canRate: (taskId: string) => api.get(`/ratings/can-rate/${taskId}`),
}

export const categoryApi = { getAll: () => api.get('/categories') }

export const userPreferencesApi = {
  get: () => api.get('/user/preferences'),
  update: (data: object) => api.put('/user/preferences', data),
}
