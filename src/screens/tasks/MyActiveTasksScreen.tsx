import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity, TextInput } from 'react-native'
import { tasksApi, disputesApi, ratingsApi } from '../../api'
import { useFocusEffect } from '@react-navigation/native'
import { LoadingScreen, EmptyState } from '../../components/Common'
import StatusBadge from '../../components/StatusBadge'
import AppModal from '../../components/AppModal'
import Button from '../../components/Button'
import { COLORS, RADIUS, SPACING, SHADOW } from '../../config/theme'

function formatRunnerPayout(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Payout unavailable'
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 'Payout unavailable'
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function MyActiveTasksScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [completeModal, setCompleteModal] = useState<any | null>(null)
  const [disputeModal, setDisputeModal] = useState<any | null>(null)
  const [ratingModal, setRatingModal] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [ratedTaskIds, setRatedTaskIds] = useState<Set<string>>(new Set())

  const loadTasks = useCallback(async () => {
    try {
      const res = await tasksApi.getMyActive()
      const data = res.data?.data || []
      setTasks(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useFocusEffect(useCallback(() => { void loadTasks() }, [loadTasks]))
  const onRefresh = () => { setRefreshing(true); loadTasks() }

  const norm = (t: any) => ({
    taskId: t.taskId,
    taskDescription: t.description || t.taskDescription || t.title || '',
    taskName: t.taskName || t.name || '',
    area: t.location || t.area || '',
    budget: t.budget || 0,
    taskStatus: t.status || t.taskStatus || '',
    dateNeeded: t.dueDate || t.dateNeeded || '',
    userName: t.creatorName || t.userName || '',
    userContact: t.creatorContact || t.userContact || '',
    payoutAmount: t.payoutAmount ?? t.PayoutAmount,
  })

  const handleComplete = async () => {
    if (!completeModal) return
    setActionLoading(true)
    try {
      await tasksApi.complete(norm(completeModal).taskId)
      setCompleteModal(null)
      await loadTasks()
      Alert.alert('Done!', 'Task marked complete. Waiting for creator to confirm.')
    } catch { Alert.alert('Error', 'Failed to mark complete.') }
    finally { setActionLoading(false) }
  }

  const handleDispute = async (issue: string, category: string) => {
    if (!disputeModal || !issue.trim()) return
    setActionLoading(true)
    try {
      await disputesApi.raise(norm(disputeModal).taskId, issue, category)
      setDisputeModal(null)
      await loadTasks()
      Alert.alert('Dispute Raised', 'An admin will review your dispute.')
    } catch { Alert.alert('Error', 'Failed to raise dispute.') }
    finally { setActionLoading(false) }
  }

  const handleRating = async () => {
    if (!ratingModal) return
    setActionLoading(true)
    try {
      const t = norm(ratingModal)
      const res = await ratingsApi.submit(t.taskId, ratingValue, ratingReview)
      if (res.data?.success) {
        setRatedTaskIds(prev => new Set(prev).add(t.taskId))
        setRatingModal(null)
        Alert.alert('Thanks!', 'Rating submitted.')
      }
    } catch { Alert.alert('Error', 'Failed to submit rating.') }
    finally { setActionLoading(false) }
  }

  const renderTask = ({ item: raw }: { item: any }) => {
    const t = norm(raw)
    const status = t.taskStatus?.toLowerCase()
    const isActive = ['claimed', 'in_progress'].includes(status)
    const isDone = ['runnerpaid', 'runner_paid', 'completed'].includes(status)
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <StatusBadge status={t.taskStatus} />
          <Text style={styles.budget}>{formatRunnerPayout(t.payoutAmount)} <Text style={styles.budgetSub}>you earn</Text></Text>
        </View>
        <Text style={styles.taskTitle} numberOfLines={2}>{t.taskName || t.taskDescription}</Text>
        <View style={styles.taskMeta}>
          <Text style={styles.metaItem}>📍 {t.area}</Text>
          {t.dateNeeded && <Text style={styles.metaItem}>📅 {new Date(t.dateNeeded).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</Text>}
          <Text style={styles.metaItem}>👤 {t.userName}</Text>
          {t.userContact && <Text style={styles.metaItem}>📞 {t.userContact}</Text>}
        </View>
        <View style={styles.actions}>
          <Button title="💬 Chat" onPress={() => navigation.navigate('TaskChat', { taskId: t.taskId, title: t.taskName || t.taskDescription })} variant="outline" size="sm" style={{ flex: 1 }} />
          {t.userContact && (
            <Button title="📞 Call" onPress={() => Alert.alert('Call', t.userContact)} variant="outline" size="sm" style={{ flex: 1 }} />
          )}
        </View>
        {isActive && (
          <View style={[styles.actions, { marginTop: 8 }]}>
            <Button title="✅ Mark Complete" onPress={() => setCompleteModal(raw)} fullWidth size="sm" />
          </View>
        )}
        {isActive && (
          <View style={[styles.actions, { marginTop: 8 }]}>
            <Button title="⚠️ Raise Dispute" onPress={() => setDisputeModal(raw)} variant="outline" size="sm" fullWidth textStyle={{ color: COLORS.danger }} />
          </View>
        )}
        {isDone && !ratedTaskIds.has(t.taskId) && (
          <View style={[styles.actions, { marginTop: 8 }]}>
            <Button title="⭐ Rate Creator" onPress={() => { setRatingModal(raw); setRatingValue(5); setRatingReview('') }} variant="outline" size="sm" fullWidth />
          </View>
        )}
      </View>
    )
  }

  if (loading) return <LoadingScreen message="Loading active tasks..." />

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={t => String(norm(t).taskId)}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <EmptyState icon="📋" title="No Active Tasks" subtitle="You haven't accepted any tasks yet." />
        }
      />

      <AppModal visible={!!completeModal} onClose={() => setCompleteModal(null)} title="Mark Task Complete"
        footer={
          <>
            <Button title="Cancel" onPress={() => setCompleteModal(null)} variant="outline" style={{ flex: 1 }} />
            <Button title="Mark Complete" onPress={handleComplete} loading={actionLoading} style={{ flex: 1 }} />
          </>
        }
      >
        {completeModal && (
          <View style={{ gap: 10 }}>
            <Text style={styles.modalText}>Confirm you have completed:</Text>
            <Text style={styles.modalBold}>{norm(completeModal).taskDescription}</Text>
            <View style={styles.infoBox}><Text style={styles.infoText}>ℹ️ The creator will be notified to confirm and release payment.</Text></View>
          </View>
        )}
      </AppModal>

      <DisputeModal
        visible={!!disputeModal}
        onClose={() => setDisputeModal(null)}
        onSubmit={handleDispute}
        loading={actionLoading}
        taskDesc={disputeModal ? norm(disputeModal).taskDescription : ''}
      />

      <AppModal visible={!!ratingModal} onClose={() => setRatingModal(null)} title="Rate the Creator"
        footer={
          <>
            <Button title="Skip" onPress={() => setRatingModal(null)} variant="outline" style={{ flex: 1 }} />
            <Button title="Submit" onPress={handleRating} loading={actionLoading} style={{ flex: 1 }} />
          </>
        }
      >
        {ratingModal && (
          <View style={{ gap: 12 }}>
            <Text style={styles.modalText}>How was working with <Text style={styles.modalBold}>{norm(ratingModal).userName}</Text>?</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRatingValue(n)}>
                  <Text style={[styles.star, n <= ratingValue && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </AppModal>
    </View>
  )
}

function DisputeModal({ visible, onClose, onSubmit, loading, taskDesc }: any) {
  const [issue, setIssue] = useState('')
  const [category, setCategory] = useState('General')
  const CATS = ['General', 'Payment', 'Quality', 'NoShow', 'Fraud']
  return (
    <AppModal visible={visible} onClose={onClose} title="Raise Dispute"
      footer={
        <>
          <Button title="Cancel" onPress={onClose} variant="outline" style={{ flex: 1 }} />
          <Button title="Submit Dispute" onPress={() => onSubmit(issue, category)} loading={loading} disabled={!issue.trim()} variant="danger" style={{ flex: 1 }} />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 14, color: '#6B7280' }}>Task: <Text style={{ fontWeight: '700', color: '#111827' }}>{taskDesc}</Text></Text>
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10 }}>
          <Text style={{ fontSize: 13, color: '#92400E' }}>⚠️ Escrow will be frozen until an admin resolves the dispute.</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATS.map(c => (
            <TouchableOpacity key={c} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: category === c ? COLORS.primary : COLORS.border, backgroundColor: category === c ? '#EEF2FF' : 'transparent' }} onPress={() => setCategory(c)}>
              <Text style={{ fontSize: 12, color: category === c ? COLORS.primary : COLORS.textSecondary, fontWeight: category === c ? '600' : '400' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>Describe the issue *</Text>
        <View style={{ borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, minHeight: 100 }}>
          <Text style={{ fontSize: 14, color: issue ? '#111827' : COLORS.textMuted }} onPress={() => {}} >{issue || 'Tap to type...'}</Text>
        </View>
      </View>
    </AppModal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, gap: 12, paddingBottom: 32 },
  taskCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.sm },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  budget: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  budgetSub: { fontSize: 11, color: COLORS.textMuted, fontWeight: '400' },
  taskTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  taskMeta: { gap: 4, marginBottom: 10 },
  metaItem: { fontSize: 12, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  modalText: { fontSize: 14, color: COLORS.textSecondary },
  modalBold: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: RADIUS.md, padding: 12 },
  infoText: { fontSize: 13, color: COLORS.info },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: COLORS.border },
  starActive: { color: COLORS.secondary },
})
