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

export const authApi = {
  login: (data: LoginModel) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterModel) => api.post<AuthResponse>('/auth/register', data),
  changePassword: (data: object) => api.post('/auth/change-password', data),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: object) => api.put('/user/profile', data),
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
  addBankAccount: (data: object) => api.post('/banking/accounts', data),
  verifyBankAccount: (id: number) => api.post(`/banking/bank-accounts/${id}/verify`, {}),
  setDefaultPayoutAccount: (id: number) => api.put(`/banking/bank-accounts/${id}/default`, {}),
  retryVerification: (id: number) => api.post(`/banking/bank-accounts/${id}/verify`, {}),
  removeBankAccount: (id: number) => api.delete(`/banking/bank-accounts/${id}`),
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
