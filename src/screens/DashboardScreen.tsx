import React, { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { tasksApi, ratingsApi } from '../api'
import { LoadingScreen } from '../components/Common'
import Button from '../components/Button'
import { COLORS, RADIUS, SHADOW } from '../config/theme'
import type { DashboardStats } from '../types'

type ActivityItem = {
  id?: string | number
  type?: string
  description?: string
  message?: string
  status?: string
  updatedAt?: string
  timestamp?: string
}

function rand(value?: number) {
  return `R${Math.round(value ?? 0).toLocaleString('en-ZA')}`
}

function activityDate(item: ActivityItem) {
  const raw = item.updatedAt || item.timestamp
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function DashboardScreen({ navigation }: any) {
  const {
    user, isProfileIncomplete, canPostErrands,
  } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [ratingAverage, setRatingAverage] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const userType = (user?.userType || '').toLowerCase()
  const canCreate = canPostErrands()
  const canRun = userType === 'runner' || userType === 'both'
  const firstName = user?.firstName?.trim() || user?.name?.split(' ')[0] || 'there'
  const profileCompletion = Math.min(100, Math.max(0, Number(user?.profileCompletion ?? (user?.profileCompleted ? 100 : (isProfileIncomplete() ? 0 : 100)))))
  const profileIsComplete = profileCompletion >= 100 && !isProfileIncomplete()

  const load = useCallback(async () => {
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        tasksApi.getDashboardStats().catch(() => ({ data: null })),
        tasksApi.getRecentActivity(4).catch(() => ({ data: null })),
      ])
      if (statsResponse.data?.data) setStats(statsResponse.data.data)
      const items = activityResponse.data?.data
      setActivity(Array.isArray(items) ? items.slice(0, 4) : [])

      if (canRun && user?.id) {
        const ratingsResponse = await ratingsApi.getForUser(user.id, 1, 5).catch(() => ({ data: null }))
        const ratings = ratingsResponse.data?.data
        setRatingAverage(Number(ratings?.average || 0))
        setRatingCount(Number(ratings?.count || 0))
      } else {
        setRatingAverage(0)
        setRatingCount(0)
      }
    } catch {
      // Keep the dashboard usable when an optional stats endpoint is temporarily unavailable.
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [canRun, user?.id])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  if (loading) return <LoadingScreen message="Getting your DFY space ready..." />

  const primaryAction = canCreate
    ? { title: 'Post a task', description: 'Get the help you need from your community.', label: 'Create a task', route: 'PostErrand' }
    : { title: 'Find your next task', description: 'Discover opportunities and earn by getting things done.', label: 'Browse tasks', route: 'BrowseErrands' }

  const metrics = userType === 'creator'
    ? [
        { label: 'Active tasks', value: stats?.activeTasks ?? 0, icon: '↗', iconBg: '#FFF0D9', iconFg: '#BC6500', tone: 'orange' },
        { label: 'Need your review', value: stats?.awaitingConfirmation ?? 0, icon: '✓', iconBg: '#EAF0FF', iconFg: '#315EC0', tone: 'blue' },
        { label: 'Tasks posted', value: stats?.postedTasks ?? 0, icon: '＋', iconBg: '#F2ECFF', iconFg: '#7650B8', tone: 'purple' },
        { label: 'Completed', value: stats?.completedPostedTasks ?? 0, icon: '★', iconBg: '#E6F7EF', iconFg: '#17865B', tone: 'green' },
      ]
    : userType === 'runner'
      ? [
          { label: 'Available tasks', value: stats?.availableTasks ?? 0, icon: '⌕', iconBg: '#FFF0D9', iconFg: '#BC6500', tone: 'orange' },
          { label: 'My active tasks', value: stats?.myActiveTasks ?? 0, icon: '↗', iconBg: '#EAF0FF', iconFg: '#315EC0', tone: 'blue' },
          { label: 'Total earnings', value: rand(stats?.totalEarnings), icon: 'R', iconBg: '#E6F7EF', iconFg: '#17865B', tone: 'green' },
          { label: 'Payouts pending', value: rand(stats?.pendingPayouts), icon: '◷', iconBg: '#F2ECFF', iconFg: '#7650B8', tone: 'purple' },
        ]
      : [
          { label: 'Active tasks', value: stats?.activeTasks ?? stats?.myActiveTasks ?? 0, icon: '↗', tone: 'orange' },
          { label: 'Need your review', value: stats?.awaitingConfirmation ?? 0, icon: '✓', tone: 'blue' },
          { label: 'Available tasks', value: stats?.availableTasks ?? 0, icon: '⌕', iconBg: '#F2ECFF', iconFg: '#7650B8', tone: 'purple' },
          { label: 'Total earnings', value: rand(stats?.totalEarnings), icon: 'R', iconBg: '#E6F7EF', iconFg: '#17865B', tone: 'green' },
        ]

  const metricToneStyles: Record<string, { background: any; text: any }> = {
    orange: { background: styles.tone_orange, text: styles.toneText_orange },
    blue: { background: styles.tone_blue, text: styles.toneText_blue },
    purple: { background: styles.tone_purple, text: styles.toneText_purple },
    green: { background: styles.tone_green, text: styles.toneText_green },
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.greetingBlock}>
        <View style={styles.eyebrow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowText}>YOUR DOFORYOU SPACE</Text>
        </View>
        <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.86}
        style={[styles.profilePrompt, profileIsComplete && styles.profilePromptComplete]}
        onPress={() => navigation.navigate('Profile')}
      >
        <View style={[styles.profilePromptIcon, profileIsComplete && styles.profilePromptIconComplete]}>
          <Text style={[styles.profilePromptIconText, profileIsComplete && styles.profilePromptIconTextComplete]}>{profileIsComplete ? '✓' : '↗'}</Text>
        </View>
        <View style={styles.profilePromptCopy}>
          <Text style={styles.profilePromptTitle}>{profileIsComplete ? 'Your profile is complete' : 'Finish setting up your profile'}</Text>
          <Text style={styles.profilePromptSub}>
            {profileIsComplete ? '100% complete · You’re ready to use DoForYou.' : `${profileCompletion}% complete · Complete your details to unlock more of DFY.`}
          </Text>
          <View style={[styles.progressTrack, profileIsComplete && styles.progressTrackComplete]}>
            <View style={[styles.progressFill, profileIsComplete && styles.progressFillComplete, { width: `${Math.min(100, Math.max(0, profileCompletion))}%` }]} />
          </View>
        </View>
        <Text style={[styles.promptArrow, profileIsComplete && styles.promptArrowComplete]}>›</Text>
      </TouchableOpacity>

      <Text style={styles.greetingSubtitle}>
        {canCreate && canRun
          ? 'What would you like to get moving today?'
          : canCreate
            ? 'Let’s get the help you need, sorted.'
            : 'Find good work. Make things happen.'}
      </Text>

      <View style={styles.actionCard}>
        <View style={styles.actionCardTop}>
          <View style={styles.actionMark}>
            <Text style={styles.actionMarkText}>{canCreate ? '＋' : '↗'}</Text>
          </View>
          <View style={styles.actionPill}>
            <Text style={styles.actionPillText}>YOUR NEXT MOVE</Text>
          </View>
          <View style={styles.actionDecorOne} />
          <View style={styles.actionDecorTwo} />
        </View>
        <Text style={styles.actionTitle}>{primaryAction.title}</Text>
        <Text style={styles.actionDescription}>{primaryAction.description}</Text>
        <View style={styles.actionButtonRow}>
          <Button
            title={primaryAction.label}
            onPress={() => navigation.navigate(primaryAction.route)}
            size="lg"
            style={styles.primaryButton}
          />
          {canCreate && canRun && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('BrowseErrands')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryActionText}>Find tasks  ›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>AT A GLANCE</Text>
          <Text style={styles.sectionTitle}>Your activity</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate(canCreate ? 'MyPostedTasks' : 'MyActiveTasks')}>
          <Text style={styles.textLink}>View tasks  ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsGrid}>
        {metrics.map((metric, index) => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIcon, metricToneStyles[metric.tone]?.background]}>
              <Text style={[styles.metricIconText, metricToneStyles[metric.tone]?.text]}>{metric.icon}</Text>
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <View style={[styles.metricAccent, index % 2 === 0 ? styles.accentWarm : styles.accentSoft]} />
          </View>
        ))}
      </View>

      {canRun && (
        <View style={styles.ratingCard}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingStar}>★</Text>
          </View>
          <View style={styles.ratingCopy}>
            <Text style={styles.ratingTitle}>Your community rating</Text>
            <Text style={styles.ratingSubtitle}>
              {ratingCount > 0
                ? `${ratingCount} review${ratingCount === 1 ? '' : 's'} from completed tasks`
                : 'Complete tasks to start building your rating.'}
            </Text>
          </View>
          {ratingCount > 0 && (
            <Text style={styles.ratingScore}>{ratingAverage.toFixed(1)}<Text style={styles.ratingOutOf}>/5</Text></Text>
          )}
        </View>
      )}

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>STAY IN THE LOOP</Text>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
      </View>

      <View style={styles.activityCard}>
        {activity.length === 0 ? (
          <View style={styles.emptyActivity}>
            <View style={styles.emptyActivityMark}><Text style={styles.emptyActivityMarkText}>✦</Text></View>
            <Text style={styles.emptyActivityTitle}>Your story starts here</Text>
            <Text style={styles.emptyActivityText}>
              {canCreate ? 'Post your first task to see updates here.' : 'Browse available tasks and your updates will appear here.'}
            </Text>
          </View>
        ) : (
          activity.map((item, index) => (
            <View
              key={String(item.id ?? `${item.type ?? 'activity'}-${index}`)}
              style={[styles.activityRow, index === activity.length - 1 && styles.activityRowLast]}
            >
              <View style={[styles.activityMark, item.type === 'created' ? styles.activityMarkOrange : styles.activityMarkBlue]}>
                <Text style={[styles.activityMarkText, item.type === 'created' ? styles.activityTextOrange : styles.activityTextBlue]}>
                  {item.type === 'created' ? '＋' : '↗'}
                </Text>
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle} numberOfLines={2}>
                  {(item.description || item.message || 'Task activity').trim()}
                </Text>
                <Text style={styles.activityMeta}>
                  {[activityDate(item), item.status].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.footerNote}>Made for everyday help and real opportunity.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 34 },
  greetingBlock: { marginBottom: 14 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full, marginBottom: 12, gap: 7,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  eyebrowText: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  greeting: { color: COLORS.textPrimary, fontSize: 29, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  greetingSubtitle: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 0, marginBottom: 22 },
  profilePrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 12, ...SHADOW.sm,
  },
  profilePromptComplete: { backgroundColor: '#F0F8F3', borderColor: '#CFE8D8' },
  profilePromptIcon: { height: 38, width: 38, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  profilePromptIconComplete: { backgroundColor: '#D9F0E2' },
  profilePromptIconText: { fontSize: 20, color: COLORS.primaryDark, fontWeight: '800' },
  profilePromptIconTextComplete: { color: '#17865B' },
  profilePromptCopy: { flex: 1, gap: 4 },
  profilePromptTitle: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '800' },
  profilePromptSub: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.backgroundDark, overflow: 'hidden', marginTop: 4 },
  progressTrackComplete: { backgroundColor: '#D9EDE1' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  progressFillComplete: { backgroundColor: '#17865B' },
  promptArrow: { fontSize: 26, color: COLORS.primaryDark, fontWeight: '400' },
  promptArrowComplete: { color: '#17865B' },

  actionCard: {
    backgroundColor: COLORS.surface, borderRadius: 26, padding: 20, marginBottom: 26,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', ...SHADOW.md,
  },
  actionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17, minHeight: 40 },
  actionMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  actionMarkText: { fontSize: 24, color: COLORS.white, fontWeight: '700', marginTop: -2 },
  actionPill: { backgroundColor: '#FFF5E9', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7, zIndex: 1 },
  actionPillText: { color: COLORS.secondary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  actionDecorOne: { position: 'absolute', width: 102, height: 102, borderRadius: 51, right: -28, top: -56, backgroundColor: '#FFF5E8' },
  actionDecorTwo: { position: 'absolute', width: 60, height: 60, borderRadius: 30, right: -8, top: -32, borderWidth: 1, borderColor: '#FFE6C9' },
  actionTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  actionDescription: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, maxWidth: 290 },
  actionButtonRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  primaryButton: { borderRadius: 14, paddingHorizontal: 20, ...SHADOW.primary },
  secondaryAction: { paddingHorizontal: 4, paddingVertical: 10 },
  secondaryActionText: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 13 },
  sectionEyebrow: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  textLink: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800', paddingBottom: 3 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18, gap: 10 },
  metricCard: {
    width: '47%', minHeight: 126, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', ...SHADOW.sm,
  },
  metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  metricIconText: { fontSize: 18, fontWeight: '800' },
  tone_orange: { backgroundColor: '#FFF0D9' },
  tone_blue: { backgroundColor: '#EAF0FF' },
  tone_purple: { backgroundColor: '#F2ECFF' },
  tone_green: { backgroundColor: '#E6F7EF' },
  toneText_orange: { color: '#BC6500' },
  toneText_blue: { color: '#315EC0' },
  toneText_purple: { color: '#7650B8' },
  toneText_green: { color: '#17865B' },
  metricValue: { color: COLORS.textPrimary, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', width: '100%' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 3, textAlign: 'center', width: '100%' },
  metricAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  accentWarm: { backgroundColor: '#FFD8A8' },
  accentSoft: { backgroundColor: '#E1E8FF' },
  ratingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 24, ...SHADOW.sm,
  },
  ratingBadge: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFF4D8', alignItems: 'center', justifyContent: 'center' },
  ratingStar: { color: '#E7A329', fontSize: 24 },
  ratingCopy: { flex: 1, gap: 4 },
  ratingTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  ratingSubtitle: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },
  ratingScore: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  ratingOutOf: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  activityCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 15, ...SHADOW.sm },
  emptyActivity: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 14 },
  emptyActivityMark: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, marginBottom: 12 },
  emptyActivityMarkText: { color: COLORS.primaryDark, fontSize: 22 },
  emptyActivityTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 5 },
  emptyActivityText: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  activityRowLast: { borderBottomWidth: 0 },
  activityMark: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityMarkOrange: { backgroundColor: '#FFF0D9' },
  activityMarkBlue: { backgroundColor: '#EAF0FF' },
  activityMarkText: { fontSize: 20, fontWeight: '700' },
  activityTextOrange: { color: '#BC6500' },
  activityTextBlue: { color: '#315EC0' },
  activityCopy: { flex: 1, gap: 4 },
  activityTitle: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  activityMeta: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  footerNote: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 24, paddingBottom: 4 },
})
