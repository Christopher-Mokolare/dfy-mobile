import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, Linking
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useFocusEffect } from '@react-navigation/native'
import { tasksApi, ratingsApi, disputesApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { LoadingScreen, EmptyState, SectionCard } from '../../components/Common'
import StatusBadge from '../../components/StatusBadge'
import AppModal from '../../components/AppModal'
import Button from '../../components/Button'
import { COLORS, RADIUS, SPACING, SHADOW, GLOBAL } from '../../config/theme'
import type { Task } from '../../types'

type Section = 'pendingPayment' | 'posted' | 'claimed' | 'completed' | 'runnerPaid'

function getInitials(name: string) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?'
}

export default function MyPostedTasksScreen({ navigation }: any) {
  const { canPostErrands } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Record<Section, boolean>>({
    pendingPayment: true, posted: true, claimed: true, completed: true, runnerPaid: false,
  })
  const [confirmModal, setConfirmModal] = useState<Task | null>(null)
  const [disputeModal, setDisputeModal] = useState<Task | null>(null)
  const [disputeIssue, setDisputeIssue] = useState('')
  const [cancelModal, setCancelModal] = useState<Task | null>(null)
  const [cancelMessage, setCancelMessage] = useState('')
  const [ratingModal, setRatingModal] = useState<Task | null>(null)
  const [detailsModal, setDetailsModal] = useState<Task | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [ratedTaskIds, setRatedTaskIds] = useState<Set<string>>(new Set())

  const loadTasks = useCallback(async () => {
    try {
      const res = await tasksApi.getMyPosted()
      const inner = res.data?.data
      const raw: Task[] = inner?.tasks || inner?.Tasks || []
      setTasks(raw)
    } catch { Alert.alert('Error', 'Failed to load tasks.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useFocusEffect(useCallback(() => { void loadTasks() }, [loadTasks]))
  const onRefresh = () => { setRefreshing(true); loadTasks() }

  const grouped = {
    pendingPayment: tasks.filter(t => t.taskStatus?.toLowerCase() === 'pendingpayment' || t.paymentStatus?.toLowerCase() === 'pending'),
    posted: tasks.filter(t => t.taskStatus?.toLowerCase() === 'posted'),
    claimed: tasks.filter(t => ['claimed', 'in_progress'].includes(t.taskStatus?.toLowerCase() || '')),
    completed: tasks.filter(t => ['completed', 'awaitingconfirmation', 'awaiting_confirmation'].includes(t.taskStatus?.toLowerCase() || '')),
    runnerPaid: tasks.filter(t => ['runnerpaid', 'runner_paid', 'confirmed'].includes(t.taskStatus?.toLowerCase() || '')),
  }

  const toggle = (sec: Section) => setExpanded(e => ({ ...e, [sec]: !e[sec] }))

  const handleConfirm = async () => {
    if (!confirmModal) return
    setActionLoading(true)
    try {
      await tasksApi.confirm(confirmModal.taskId)
      setConfirmModal(null)
      await loadTasks()
      Alert.alert('Completion confirmed', 'Escrow was released and the runner payout has been queued. You will be notified when Paystack confirms the transfer.')
    } catch { Alert.alert('Error', 'Failed to confirm task.') }
    finally { setActionLoading(false) }
  }

  const handleRaiseDispute = async () => {
    if (!disputeModal) return
    const issue = disputeIssue.trim()
    if (issue.length < 10) {
      Alert.alert('More detail needed', 'Please describe the completion issue in at least 10 characters.')
      return
    }
    setActionLoading(true)
    try {
      const result = await disputesApi.raise(disputeModal.taskId, issue, 'TaskCompletion')
      if (!result.data?.success) {
        Alert.alert('Unable to raise dispute', result.data?.message || 'The dispute could not be submitted.')
        return
      }
      setDisputeModal(null)
      setDisputeIssue('')
      await loadTasks()
      Alert.alert('Dispute submitted', 'Escrow is frozen while the dispute awaits admin review.')
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit the dispute.')
    } finally { setActionLoading(false) }
  }

  const handleCancel = async () => {
    if (!cancelModal) return
    setActionLoading(true)
    try {
      const res = await tasksApi.cancel(cancelModal.taskId, 'Cancelled by creator')
      setCancelMessage(res.data?.message || 'Task cancelled.')
      await loadTasks()
    } catch { setCancelMessage('Failed to cancel task.') }
    finally { setActionLoading(false) }
  }

  const handleRating = async () => {
    if (!ratingModal) return
    setActionLoading(true)
    try {
      const res = await ratingsApi.submit(ratingModal.taskId, ratingValue, ratingReview)
      if (res.data?.success) {
        setRatedTaskIds(prev => new Set(prev).add(ratingModal.taskId))
        setRatingModal(null); setRatingReview(''); setRatingValue(5)
        Alert.alert('Thanks!', 'Rating submitted.')
      } else { Alert.alert('Error', res.data?.message || 'Failed to submit rating') }
    } catch { Alert.alert('Error', 'Failed to submit rating') }
    finally { setActionLoading(false) }
  }

  const handlePayNow = async (taskId: string) => {
    try {
      const response = await tasksApi.getPaymentUrl(taskId)
      const url = response.data?.data?.paymentUrl
      if (!url) {
        Alert.alert('Payment unavailable', 'DFY could not create a checkout link for this task. Refresh the task and try again.')
        return
      }
      await WebBrowser.openBrowserAsync(url)
      // Browser dismissal is not proof of payment. The backend webhook and
      // verification flow remain authoritative for the task's payment state.
      await loadTasks()
    } catch (error: any) {
      Alert.alert('Payment unavailable', error.response?.data?.message || 'Could not get a checkout link. Please refresh and try again.')
    }
  }

  if (loading) return <LoadingScreen message="Loading your posted tasks..." />

  const SECTIONS: { key: Section; icon: string; label: string }[] = [
    { key: 'pendingPayment', icon: '⚠️', label: 'Pending Payment' },
    { key: 'posted', icon: '📢', label: 'Live on Browse Errands' },
    { key: 'claimed', icon: '⏳', label: 'In Progress' },
    { key: 'completed', icon: '🕐', label: 'Awaiting Confirmation' },
    { key: 'runnerPaid', icon: '✅', label: 'Completed' },
  ]

  const renderTask = (task: Task, sectionKey: Section) => (
    <View key={task.taskId || task.id} style={s.taskCard}>
      {/* .task-card-header */}
      <View style={s.taskCardHeader}>
        <StatusBadge status={task.taskStatus || ''} />
        <Text style={s.taskBudget}>R{task.budget}</Text>
      </View>

      {/* .task-card-body */}
      <View style={s.taskCardBody}>
        <Text style={s.taskTitle} numberOfLines={2}>{task.taskName || task.taskDescription}</Text>
        {task.taskName && (
          <Text style={s.taskSubtitle} numberOfLines={2}>{task.taskDescription}</Text>
        )}
        <View style={s.taskMeta}>
          <Text style={s.taskMetaItem}>🏷️ {task.category || 'General'}</Text>
          <Text style={s.taskMetaItem}>📅 {new Date(task.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <Text style={s.taskMetaItem}>📍 {task.area?.length > 30 ? task.area.substring(0, 30) + '...' : task.area}</Text>
        </View>

        {/* .runner-info */}
        {task.helperName ? (
          <View style={s.runnerInfo}>
            <View style={s.runnerAvatar}>
              <Text style={s.runnerAvatarText}>{getInitials(task.helperName)}</Text>
            </View>
            <View>
              <Text style={s.runnerName}>{task.helperName}</Text>
              <Text style={s.runnerContact}>{task.helperContact}</Text>
            </View>
          </View>
        ) : (
          <View style={s.runnerInfo}>
            <View style={[s.runnerAvatar, s.runnerAvatarEmpty]}>
              <Text style={{ color: COLORS.textSecondary }}>👤</Text>
            </View>
            <Text style={s.runnerEmpty}>No runner yet</Text>
          </View>
        )}
      </View>

      {/* .task-card-footer — action rows matching web */}
      <View style={s.taskCardFooter}>
        {sectionKey === 'pendingPayment' && (
          <View style={s.actionRow}>
            <Button title="Edit" onPress={() => navigation.navigate('PostErrand', { editId: task.taskId })} variant="outline" size="sm" style={{ flex: 1 }} />
            <Button title="Cancel" onPress={() => { setCancelModal(task); setCancelMessage('') }} variant="danger" size="sm" style={{ flex: 1 }} />
            <Button title="Pay Now" onPress={() => handlePayNow(task.taskId)} size="sm" style={{ flex: 1 }} />
          </View>
        )}
        {sectionKey === 'posted' && (
          <View style={s.actionCol}>
            <Button title="View Details" onPress={() => setDetailsModal(task)} fullWidth size="sm" variant="primary" />
            <Button title="Cancel Task" onPress={() => { setCancelModal(task); setCancelMessage('') }} fullWidth size="sm" variant="outline" style={{ marginTop: 8, borderColor: COLORS.danger }} textStyle={{ color: COLORS.danger }} />
          </View>
        )}
        {(sectionKey === 'claimed' || sectionKey === 'completed') && (
          <View style={s.actionCol}>
            <View style={s.actionRow}>
              <Button title="💬 Chat" onPress={() => navigation.navigate('TaskChat', { taskId: task.taskId, title: task.taskName || task.taskDescription })} variant="outline" size="sm" style={{ flex: 1 }} />
              {task.helperContact && (
                <Button title="📞 Call" onPress={() => Linking.openURL(`tel:${task.helperContact}`)} variant="outline" size="sm" style={{ flex: 1 }} />
              )}
            </View>
            {sectionKey === 'completed' && (
              ['awaitingconfirmation', 'awaiting_confirmation'].includes(task.taskStatus?.toLowerCase() || '') ? (
                ['disputepending'].includes(task.paymentStatus?.toLowerCase() || '') || task.escrowStatus?.toLowerCase() === 'disputed' ? (
                  <View style={[s.infoBox, { marginTop: 8 }]}><Text style={s.infoText}>A dispute is open. Escrow remains frozen pending review.</Text></View>
                ) : (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <Button title="✅ Confirm Completion" onPress={() => setConfirmModal(task)} fullWidth size="sm" />
                    <Button title="Raise Dispute" onPress={() => { setDisputeModal(task); setDisputeIssue('') }} fullWidth size="sm" variant="outline" />
                  </View>
                )
              ) : null
            )}
            {sectionKey === 'claimed' && (
              <View style={{ marginTop: 8, gap: 8 }}>
                <Button title="View Details" onPress={() => setDetailsModal(task)} fullWidth size="sm" variant="secondary" />
                <Button title="Cancel Task" onPress={() => { setCancelModal(task); setCancelMessage('') }} fullWidth size="sm" variant="outline" style={{ borderColor: COLORS.danger }} textStyle={{ color: COLORS.danger }} />
              </View>
            )}
          </View>
        )}
        {sectionKey === 'runnerPaid' && (
          <View style={s.actionRow}>
            <Button title="View Details" onPress={() => setDetailsModal(task)} size="sm" style={{ flex: 1 }} />
            {task.helperContact && (
              <Button title="📞" onPress={() => Linking.openURL(`tel:${task.helperContact}`)} variant="outline" size="sm" />
            )}
            {!ratedTaskIds.has(task.taskId) && (
              <Button title="⭐ Rate" onPress={() => { setRatingModal(task); setRatingReview(''); setRatingValue(5) }} variant="outline" size="sm" />
            )}
          </View>
        )}
      </View>
    </View>
  )

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* .page-header */}
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderTitle}>My Posted Tasks</Text>
        <Text style={s.pageHeaderSub}>Manage and track your posted tasks</Text>
      </View>

      <View style={s.body}>
        {canPostErrands() && (
          <Button title="+ Post New Task" onPress={() => navigation.navigate('PostErrand')} fullWidth style={{ marginBottom: SPACING.md }} />
        )}

        {tasks.length === 0 ? (
          <EmptyState icon="📋" title="No Posted Tasks" subtitle="You haven't posted any tasks yet." />
        ) : (
          SECTIONS.map(({ key, icon, label }) => grouped[key].length > 0 && (
            <View key={key} style={s.statusSection}>
              {/* .status-heading */}
              <TouchableOpacity style={s.statusHeading} onPress={() => toggle(key)}>
                <Text style={s.statusHeadingText}>{icon} {label} ({grouped[key].length})</Text>
                <Text style={s.statusHeadingChevron}>{expanded[key] ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {expanded[key] && (
                <View style={s.tasksGrid}>
                  {grouped[key].map(task => renderTask(task, key))}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Confirm Modal */}
      <AppModal visible={!!confirmModal} onClose={() => setConfirmModal(null)} title="Confirm Task Completion"
        footer={
          <>
            <Button title="Cancel" onPress={() => setConfirmModal(null)} variant="secondary" style={{ flex: 1 }} />
            <Button title="Confirm & Release Payment" onPress={handleConfirm} loading={actionLoading} style={{ flex: 1 }} />
          </>
        }
      >
        {confirmModal && (
          <View style={{ gap: 10 }}>
            <Text style={s.modalText}>Are you satisfied with the completion of:</Text>
            <Text style={s.modalBold}>{confirmModal.taskDescription}</Text>
            <View style={s.infoBox}><Text style={s.infoText}>ℹ️ Confirming releases escrow into the runner payout process. Paystack must still confirm the transfer before the runner is shown as paid.</Text></View>
          </View>
        )}
      </AppModal>

      {/* Creator dispute modal */}
      <AppModal visible={!!disputeModal} onClose={() => { if (!actionLoading) { setDisputeModal(null); setDisputeIssue('') } }} title="Raise a Completion Dispute"
        footer={
          <>
            <Button title="Cancel" onPress={() => { setDisputeModal(null); setDisputeIssue('') }} variant="secondary" style={{ flex: 1 }} disabled={actionLoading} />
            <Button title="Submit Dispute" onPress={handleRaiseDispute} loading={actionLoading} style={{ flex: 1 }} />
          </>
        }
      >
        {disputeModal && (
          <View style={{ gap: 10 }}>
            <Text style={s.modalText}>Describe what is wrong with the runner's completed work. Submitting a dispute freezes escrow while an administrator reviews it.</Text>
            <Text style={s.modalBold}>{disputeModal.taskName || disputeModal.taskDescription}</Text>
            <TextInput
              style={s.disputeInput}
              value={disputeIssue}
              onChangeText={setDisputeIssue}
              placeholder="Explain the issue (at least 10 characters)"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              editable={!actionLoading}
            />
            <Text style={s.modalMeta}>{disputeIssue.trim().length}/1000 characters</Text>
          </View>
        )}
      </AppModal>

      {/* Cancel Modal */}
      <AppModal visible={!!cancelModal} onClose={() => { if (!actionLoading) { setCancelModal(null); setCancelMessage('') } }} title="Cancel Task"
        footer={
          cancelMessage && !cancelMessage.includes('Failed') ? (
            <Button title="Done" onPress={() => { setCancelModal(null); setCancelMessage('') }} fullWidth />
          ) : (
            <>
              <Button title="Keep Task" onPress={() => { setCancelModal(null); setCancelMessage('') }} variant="secondary" style={{ flex: 1 }} disabled={actionLoading} />
              <Button title="Yes, Cancel Task" onPress={handleCancel} loading={actionLoading} variant="danger" style={{ flex: 1 }} />
            </>
          )
        }
      >
        {cancelModal && (
          <View style={{ gap: 10 }}>
            {cancelMessage ? (
              <View style={[s.infoBox, { backgroundColor: cancelMessage.includes('Failed') ? '#FEE2E2' : '#DCFCE7' }]}>
                <Text style={{ color: cancelMessage.includes('Failed') ? COLORS.danger : COLORS.success }}>{cancelMessage}</Text>
              </View>
            ) : (
              <>
                <Text style={s.modalBold} numberOfLines={2}>{cancelModal.taskName || cancelModal.taskDescription}</Text>
                <Text style={s.modalText}>Are you sure you want to cancel this task?</Text>
                {cancelModal.taskStatus?.toLowerCase() === 'pendingpayment' && (
                  <View style={s.infoBox}><Text style={s.infoText}>ℹ️ No payment was made. This task will be removed at no cost.</Text></View>
                )}
              </>
            )}
          </View>
        )}
      </AppModal>

      {/* Rating Modal */}
      <AppModal visible={!!ratingModal} onClose={() => setRatingModal(null)} title="Rate the Runner"
        footer={
          <>
            <Button title="Skip" onPress={() => setRatingModal(null)} variant="secondary" style={{ flex: 1 }} />
            <Button title="Submit Rating" onPress={handleRating} loading={actionLoading} style={{ flex: 1 }} />
          </>
        }
      >
        {ratingModal && (
          <View style={{ gap: 12 }}>
            <Text style={s.modalText}>How was <Text style={s.modalBold}>{ratingModal.helperName}</Text>?</Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRatingValue(n)}>
                  <Text style={[s.star, n <= ratingValue && s.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </AppModal>

      {/* Details Modal */}
      <AppModal visible={!!detailsModal} onClose={() => setDetailsModal(null)} title="Task Details"
        footer={<Button title="Close" onPress={() => setDetailsModal(null)} variant="secondary" fullWidth />}
      >
        {detailsModal && (
          <View style={{ gap: 10 }}>
            <Text style={s.modalBold}>{detailsModal.taskName || detailsModal.taskId}</Text>
            <Text style={s.modalText}>{detailsModal.taskDescription}</Text>
            <Text style={s.modalMeta}>🏷️ {detailsModal.category}</Text>
            <Text style={s.modalMeta}>📍 {detailsModal.area}</Text>
            <Text style={s.modalMeta}>💰 R{detailsModal.budget}</Text>
            {detailsModal.helperName && <Text style={s.modalMeta}>👤 Runner: {detailsModal.helperName}</Text>}
            {detailsModal.notes && <Text style={s.modalMeta}>📝 {detailsModal.notes}</Text>}
          </View>
        )}
      </AppModal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  pageHeader: { backgroundColor: COLORS.primary, padding: SPACING.lg, marginBottom: SPACING.lg },
  pageHeaderTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 4 },
  pageHeaderSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  body: { paddingHorizontal: SPACING.md },

  // .status-section
  statusSection: { marginBottom: SPACING.lg },
  statusHeading: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: 16, marginBottom: 14,
  },
  statusHeadingText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  statusHeadingChevron: { color: COLORS.primary, fontSize: 12 },
  tasksGrid: { gap: 20 },

  // .task-card
  taskCard: { ...GLOBAL.taskCard },
  taskCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  taskBudget: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  taskCardBody: { padding: SPACING.md, flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  taskSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  taskMeta: { gap: 4, marginBottom: 10 },
  taskMetaItem: { fontSize: 13, color: COLORS.textSecondary },

  // .runner-info
  runnerInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  runnerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  runnerAvatarEmpty: { backgroundColor: COLORS.border },
  runnerAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  runnerName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  runnerContact: { fontSize: 13, color: COLORS.textSecondary },
  runnerEmpty: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },

  taskCardFooter: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionCol: { flexDirection: 'column' },

  // Modals
  modalText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  modalBold: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  modalMeta: { fontSize: 14, color: COLORS.textPrimary },
  infoBox: { backgroundColor: '#DBEAFE', borderRadius: RADIUS.md, padding: 12 },
  disputeInput: { minHeight: 120, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  infoText: { fontSize: 13, color: '#1E40AF' },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: COLORS.border },
  starActive: { color: COLORS.starColor },
})
