export interface LoginModel { email: string; password: string; secondFactorCode?: string }
export interface RegisterModel {
  firstName: string; lastName: string; email: string; phoneNumber: string
  userType: string; password: string
  termsAccepted: boolean; privacyAccepted: boolean; termsVersion: string; privacyVersion: string; marketingConsent: boolean
}
export interface User {
  id: number; name: string; firstName?: string; lastName?: string; email: string
  contact: string; phoneNumber?: string; userType?: string; isVerified: boolean
  emailVerified?: boolean; phoneVerified?: boolean
  identityVerificationStatus?: string; authenticatorTwoFactorEnabled?: boolean
  hasVerifiedPayoutAccount?: boolean; hasGoogleLogin?: boolean; hasPasswordLogin?: boolean
  marketingConsent?: boolean; marketingConsentUpdatedAt?: string; marketingConsentVersion?: string
  profileCompleted: boolean; profileCompletion?: number; missingProfileFields?: string[]
  canCreateTasks?: boolean; canAcceptTasks?: boolean; rating: number
  completedTasks: number; createdAt: string; lastLoginAt?: string
  roles?: string[]; isAdmin?: boolean; idNumber?: string; hasIdNumber?: boolean; idNumberLastFour?: string; address?: string
}
export interface AuthResponse {
  success: boolean; message: string; user?: User; token?: string
  refreshToken?: string; expiration?: string
  requiresEmailVerification?: boolean; emailVerificationRequired?: boolean
  requiresTwoFactor?: boolean; requiresAccountSetup?: boolean; requiresAccountLink?: boolean
}
export interface GoogleRegisterModel {
  idToken: string; firstName: string; lastName: string; phoneNumber: string; userType: string
  termsAccepted: boolean; privacyAccepted: boolean; termsVersion: string; privacyVersion: string; marketingConsent: boolean
}
export type PaymentStatus =
  | 'Pending' | 'EscrowHeld' | 'EscrowReleased' | 'PayoutPending' | 'Processing'
  | 'RunnerPaid' | 'PayoutReturned' | 'PayoutCancelled' | 'PayoutFailed' | 'AwaitingEligibility'
  | 'Completed' | 'DisputePending' | 'RefundPending' | 'Refunded' | 'Failed' | 'Expired'
  | 'pending' | 'verified' | 'failed' | 'expired' | 'refunded' | 'escrow_held'
export type TaskStatus =
  | 'draft' | 'posted' | 'claimed' | 'in_progress' | 'completed' | 'awaiting_confirmation'
  | 'confirmed' | 'runner_paid' | 'cancelled' | 'disputed' | 'payout_pending' | 'refund_pending'
  | 'PendingPayment' | 'Posted' | 'Claimed' | 'InProgress' | 'Completed' | 'AwaitingConfirmation'
  | 'Confirmed' | 'RunnerPaid' | 'PayoutPending' | 'PayoutFailed' | 'PayoutReturned'
  | 'PayoutCancelled' | 'Processing' | 'AwaitingFunds' | 'AwaitingBankDetails'
  | 'Cancelled' | 'DisputePending' | 'RefundPending'
export type Priority = 'standard' | 'urgent' | 'low'
export interface Task {
  id: number; taskId: string; timestamp?: string; userName: string; userContact: string
  createdByUserId: number; taskName?: string; taskDescription: string; area: string
  dateNeeded: string; budget: number; commissionPercentage?: number; commissionAmount?: number; payoutAmount?: number; notes?: string; paymentStatus: PaymentStatus; payoutStatus?: string
  taskStatus: TaskStatus; helperName?: string; helperContact?: string; helperEmail?: string
  acceptedByUserId?: number; priority: Priority; category?: string; createdAt: string
  updatedAt?: string; completedAt?: string; escrowStatus?: 'none' | 'pending' | 'held' | 'released' | 'refunded' | 'disputed' | 'refund_pending'; escrowHoldUntil?: string
  task_description?: string; area_suburb?: string; date_time_needed?: string
  contact_number?: string; name_and_surname?: string; taskid?: string; status?: string
  canAccept?: boolean; canEdit?: boolean; canComplete?: boolean; canCancel?: boolean
  canConfirm?: boolean; canMessage?: boolean; canDispute?: boolean
}
export interface ChatMessage {
  id: string | number; taskId: string; senderId: number; senderName: string
  content: string; timestamp: string; isRead: boolean; isCurrentUser: boolean
}
export interface WalletBalance {
  availableBalance: number; pendingPayouts: number; totalEarned: number; totalWithdrawn: number
}
export interface BankAccount {
  id: number; bankName: string; bankCode?: string; accountNumber: string
  accountHolderName: string; accountType: string; branchCode?: string
  isVerified: boolean; isDefault?: boolean; isDefaultPayout?: boolean; verificationMessage?: string; createdAt?: string
}
export interface SupportedBank { bankCode: string; bankGroupId?: string; name: string; branchCode?: string | null }
export interface AppNotification {
  id: number; type: string; title: string; message: string; isRead: boolean
  createdAt: string; updatedAt: string; count: number
  relatedTaskId?: number | null; relatedTaskStringId?: string | null; expiresAt?: string | null
}
export interface DashboardStats {
  postedTasks?: number; pendingPayment?: number; activeTasks?: number
  awaitingConfirmation?: number; completedPostedTasks?: number; totalSpent?: number
  thisMonthSpending?: number; averageTaskCost?: number; availableTasks?: number
  myActiveTasks?: number; runnerCompletedTasks?: number; totalEarnings?: number
  availableBalance?: number; pendingPayouts?: number; thisMonthEarnings?: number
  completionRate?: number; averageEarning?: number; myRating?: number
}
