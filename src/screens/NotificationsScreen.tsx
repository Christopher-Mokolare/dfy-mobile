import React, { useCallback, useState, useMemo } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'
import { COLORS, RADIUS, SPACING, SHADOW } from '../config/theme'
import type { AppNotification } from '../types'

const TYPE_ICON: Record<string, string> = {
  task_claimed: '✋', task_completed: '✅', task_posted: '📢',
  payment_received: '💰', payment_verified: '🛡️', new_message: '💬', system: '⚙️',
}
const TYPE_COLOR: Record<string, string> = {
  task_claimed: '#F59E0B', task_completed: '#22C55E', task_posted: '#3B82F6',
  payment_received: '#10B981', payment_verified: '#10B981', new_message: COLORS.primary, system: '#6B7280',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

type Tab = 'all' | 'unread' | 'messages' | 'tasks' | 'payments'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' },
  { id: 'messages', label: 'Messages' }, { id: 'tasks', label: 'Tasks' }, { id: 'payments', label: 'Payments' },
]

export default function NotificationsScreen({ navigation }: any) {
  const { notifications, unreadCount, loading, hasMore, loadMore, markRead, markAllRead, markTaskNotificationsRead, remove, clearRead, refresh } = useNotifications()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('Admin')
  const [tab, setTab] = useState<Tab>('all')
  const [refreshing, setRefreshing] = useState(false)
  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  const filtered = useMemo(() => {
    let base = notifications
    if (tab === 'unread') base = base.filter(n => !n.isRead)
    else if (tab === 'messages') base = base.filter(n => n.type === 'new_message')
    else if (tab === 'tasks') base = base.filter(n => ['task_claimed','task_completed','task_posted'].includes(n.type))
    else if (tab === 'payments') base = base.filter(n => ['payment_received','payment_verified','payment_released'].includes(n.type))

    const seen = new Map<string, { n: AppNotification; count: number; hasUnread: boolean }>()
    for (const n of base) {
      const key = `${n.type}::${n.relatedTaskId ?? 'none'}`
      const existing = seen.get(key)
      if (existing) {
        existing.count += n.count ?? 1
        if (!n.isRead) existing.hasUnread = true
      } else {
        seen.set(key, { n, count: n.count ?? 1, hasUnread: !n.isRead })
      }
    }
    return Array.from(seen.values())
  }, [notifications, tab])

  const handleClick = async (n: AppNotification) => {
    if (n.type === 'new_message' && n.relatedTaskId != null) {
      markTaskNotificationsRead(n.relatedTaskStringId || String(n.relatedTaskId))
      // Legacy notifications can carry only the numeric database ID. The API and
      // SignalR hub resolve that alias and return/use the canonical public TaskId.
      const taskIdentifier = n.relatedTaskStringId || String(n.relatedTaskId)
      navigation.navigate('TaskChat', { taskId: taskIdentifier, title: 'Task Chat' })
      return
    }

    if (!n.isRead) await markRead(n.id)
    if (n.type === 'payment_received') navigation.navigate('MyCompletedTasks')
    else if (n.relatedTaskStringId || n.relatedTaskId != null) navigation.navigate('MyPostedTasks')
  }

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false) }

  const renderItem = ({ item: { n, count, hasUnread } }: { item: { n: AppNotification; count: number; hasUnread: boolean } }) => {
    const icon = TYPE_ICON[n.type] || '🔔'
    const color = TYPE_COLOR[n.type] || '#6B7280'
    return (
      <TouchableOpacity
        style={[styles.notifItem, hasUnread && styles.notifItemUnread]}
        onPress={() => handleClick(n)}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIcon, { backgroundColor: color + '20' }]}>
          <Text style={styles.notifIconText}>{icon}</Text>
          {count > 1 && (
            <View style={[styles.countBadge, { backgroundColor: color }]}>
              <Text style={styles.countBadgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
        <View style={styles.notifBody}>
          <View style={styles.notifTitleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>{n.title}{count > 1 ? ` · ${count}x` : ''}</Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{n.message.replace(/https?:\/\/\S+/g, '').trim()}</Text>
          <Text style={styles.notifTime}>{timeAgo(n.updatedAt || n.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(n.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Action bar */}
      {(unreadCount > 0 || notifications.some(n => n.isRead)) && (
        <View style={styles.actionBar}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={markAllRead}>
              <Text style={styles.actionBtnText}>✓ Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.some(n => n.isRead) && (
            <TouchableOpacity style={styles.actionBtn} onPress={clearRead}>
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>🗑 Clear read</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={({ n }) => String(n.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No {tab !== 'all' ? tab : ''} notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
          </View>
        }
        ListFooterComponent={
          hasMore && tab === 'all' ? (
            <Button title="Load more" onPress={loadMore} variant="outline" fullWidth style={{ margin: SPACING.md }} />
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  actionBar: { flexDirection: 'row', gap: 10, padding: SPACING.md, paddingBottom: 0 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border },
  actionBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  tabsRow: { flexDirection: 'row', padding: SPACING.md, paddingBottom: 8, gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tabBtnTextActive: { color: COLORS.white, fontWeight: '700' },
  list: { padding: SPACING.md, gap: 8, paddingBottom: 32 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  notifItemUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  notifIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifIconText: { fontSize: 20 },
  countBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  countBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '700' },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  notifMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 14, color: COLORS.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary },
})
