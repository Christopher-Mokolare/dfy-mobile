import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { tasksApi, ratingsApi, disputesApi } from '../../api'
import { EmptyState, LoadingScreen } from '../../components/Common'
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

export default function MyCompletedTasksScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ratingTask, setRatingTask] = useState<any>(null)
  const [rating, setRating] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await tasksApi.getMyCompleted()
      const data = res.data?.data
      setTasks(Array.isArray(data) ? data : data?.tasks || [])
    } catch {
      Alert.alert('Error', 'Failed to load completed tasks.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const submitRating = async () => {
    if (!ratingTask) return
    setActionLoading(true)
    try {
      const response = await ratingsApi.submit(ratingTask.taskId, rating, ratingReview)
      if (!response.data?.success) {
        Alert.alert('Unable to submit rating', response.data?.message || 'Your rating was not submitted. Please try again.')
        return
      }
      setRatingTask(null); setRatingReview('')
      Alert.alert('Thanks!', 'Your rating was submitted.')
    } catch { Alert.alert('Error', 'Failed to submit rating.') }
    finally { setActionLoading(false) }
  }

  if (loading) return <LoadingScreen message="Loading completed tasks..." />

  return (
    <View style={s.page}>
      <View style={s.header}>
        <Text style={s.title}>Completed Tasks</Text>
        <Text style={s.subtitle}>Your completed task history and ratings</Text>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(t, i) => String(t.taskId || t.id || i)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState icon="✅" title="No Completed Tasks" subtitle="Completed tasks will appear here." />}
        renderItem={({ item: t }) => {
          const title = t.taskName || t.name || t.taskDescription || t.description || 'Task'
          const status = t.taskStatus || t.status || 'Completed'
          const taskId = t.taskId || t.taskid
          return (
            <View style={s.card}>
              <View style={s.row}>
                <StatusBadge status={status} />
                <Text style={s.amount}>{formatRunnerPayout(t.payoutAmount ?? t.PayoutAmount)}</Text>
              </View>
              <Text style={s.taskTitle}>{title}</Text>
              <Text style={s.meta}>📍 {t.area || t.location || 'Location not specified'}</Text>
              {t.completedAt && <Text style={s.meta}>✅ {new Date(t.completedAt).toLocaleDateString('en-ZA')}</Text>}
              <View style={s.actions}>
                <Button title="View Chat" onPress={() => navigation.navigate('TaskChat', { taskId, title })} variant="outline" size="sm" style={{ flex: 1 }} />
                <Button title="Rate" onPress={() => { setRatingTask(t); setRating(5) }} size="sm" style={{ flex: 1 }} />
              </View>
            </View>
          )
        }}
      />
      <AppModal visible={!!ratingTask} onClose={() => setRatingTask(null)} title="Rate this task">
        {ratingTask && <View style={{ gap: 12 }}>
          <Text style={s.meta}>{ratingTask.taskName || ratingTask.taskDescription || 'Task'}</Text>
          <View style={s.stars}>
            {[1,2,3,4,5].map(n => <Text key={n} onPress={() => setRating(n)} style={[s.star, n <= rating && s.starActive]}>★</Text>)}
          </View>
          <Button title="Submit Rating" onPress={submitRating} loading={actionLoading} fullWidth />
        </View>}
      </AppModal>
    </View>
  )
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:COLORS.background},
  header:{backgroundColor:COLORS.primary,padding:SPACING.lg},
  title:{fontSize:26,fontWeight:'700',color:'#fff'},
  subtitle:{fontSize:14,color:'rgba(255,255,255,.85)',marginTop:4},
  list:{padding:SPACING.md,gap:12,paddingBottom:32},
  card:{backgroundColor:COLORS.surface,borderRadius:RADIUS.xl,padding:SPACING.md,...SHADOW.sm},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  amount:{fontSize:20,fontWeight:'700',color:COLORS.primary},
  taskTitle:{fontSize:16,fontWeight:'700',color:COLORS.textPrimary,marginTop:10,marginBottom:8},
  meta:{fontSize:13,color:COLORS.textSecondary},
  actions:{flexDirection:'row',gap:8,marginTop:12},
  stars:{flexDirection:'row',gap:8},
  star:{fontSize:34,color:COLORS.border},
  starActive:{color:COLORS.starColor},
})
