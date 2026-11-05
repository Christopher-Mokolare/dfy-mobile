import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  AppState, View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import * as signalR from '@microsoft/signalr'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { tasksApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { COLORS, RADIUS, SPACING, SHADOW } from '../../config/theme'
import ENV from '../../config/env'
import type { ChatMessage } from '../../types'

const POLL_INTERVAL = 5000

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase() || '?'
}

function formatTime(ts: string) {
  const date = new Date(ts)
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function TaskChatScreen({ route, navigation }: any) {
  const { taskId, title } = route.params || {}
  const { user } = useAuth()
  const { markTaskNotificationsRead } = useNotifications()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)

  const hubRef = useRef<signalR.HubConnection | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownIdsRef = useRef<Set<string | number>>(new Set())
  const flatListRef = useRef<FlatList>(null)

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    const toAdd = incoming.filter(msg => !knownIdsRef.current.has(String(msg.id)))
    if (toAdd.length === 0) return
    toAdd.forEach(msg => knownIdsRef.current.add(String(msg.id)))
    const normalized = toAdd.map(msg => ({ ...msg, id: String(msg.id) }))
    setMessages(prev =>
      [...prev, ...normalized].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    )
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await tasksApi.getMessages(taskId)
      if (res.data?.success) {
        const raw: ChatMessage[] = res.data.data || []
        mergeMessages(raw)
        if (raw.some(m => !m.isCurrentUser && !m.isRead)) {
          tasksApi.markMessagesRead(taskId).catch(() => {})
        }
      }
    } catch {}
    finally { setLoading(false) }
  }, [taskId, mergeMessages])

  useEffect(() => {
    if (!taskId) return
    const setupHub = async () => {
      const token = await AsyncStorage.getItem('token')
      if (!token) return
      const hubUrl = `${ENV.signalRUrl}/api/v1/hubs/chat`
      const hub = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, { accessTokenFactory: () => token, skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build()

      hub.on('ReceiveMessage', (msg: ChatMessage) => {
        mergeMessages([{ ...msg, isCurrentUser: msg.senderId === user?.id }])
      })
      hub.onreconnected(() => {
        setConnected(true)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        void fetchMessages()
      })
      hub.onclose(() => {
        setConnected(false)
        if (!pollRef.current) pollRef.current = setInterval(fetchMessages, POLL_INTERVAL)
      })
      hub.start()
        .then(async () => {
          setConnected(true)
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
          await hub.invoke('JoinTaskChat', String(taskId))
        })
        .catch(() => { setConnected(false) })
      hubRef.current = hub
    }
    setupHub()
    return () => {
      hubRef.current?.invoke('LeaveTaskChat', String(taskId)).catch(() => {})
      hubRef.current?.stop()
      hubRef.current = null
    }
  }, [taskId, user?.id, mergeMessages, fetchMessages])

  useEffect(() => {
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [fetchMessages])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void fetchMessages()
    })
    return () => subscription.remove()
  }, [fetchMessages])

  useEffect(() => {
    if (taskId) markTaskNotificationsRead(taskId)
  }, [taskId, markTaskNotificationsRead])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  const handleSend = async () => {
    const text = newMessage.trim()
    if (!text || sending || !taskId) return
    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId, taskId, senderId: user?.id ?? 0,
      senderName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name : 'You',
      content: text, timestamp: new Date().toISOString(), isRead: false, isCurrentUser: true,
    }
    knownIdsRef.current.add(tempId)
    setMessages(prev => [...prev, optimistic])
    setNewMessage('')
    setSending(true)
    try {
      await tasksApi.sendMessage(taskId, text)
      const res = await tasksApi.getMessages(taskId)
      if (res.data?.success) {
        const incoming: ChatMessage[] = (res.data.data || []).map((m: ChatMessage) => ({ ...m, id: String(m.id) }))
        incoming.forEach(m => knownIdsRef.current.add(String(m.id)))
        setMessages(incoming.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()))
        knownIdsRef.current.delete(tempId)
      }
    } catch {
      setMessages(prev => prev.filter(m => String(m.id) !== tempId))
      knownIdsRef.current.delete(tempId)
    } finally { setSending(false) }
  }

  const renderMessage = ({ item: msg }: { item: ChatMessage }) => (
    <View style={[styles.msgRow, msg.isCurrentUser ? styles.msgRowMine : styles.msgRowTheirs]}>
      {!msg.isCurrentUser && (
        <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(msg.senderName)}</Text></View>
      )}
      <View style={styles.bubbleWrap}>
        {!msg.isCurrentUser && <Text style={styles.senderName}>{msg.senderName}</Text>}
        <View style={[styles.bubble, msg.isCurrentUser ? styles.bubbleMine : styles.bubbleTheirs, String(msg.id).startsWith('temp-') && styles.bubbleSending]}>
          <Text style={[styles.msgText, msg.isCurrentUser && styles.msgTextMine]}>{msg.content}</Text>
          <Text style={[styles.msgTime, msg.isCurrentUser && styles.msgTimeMine]}>{formatTime(msg.timestamp)}</Text>
        </View>
      </View>
      {msg.isCurrentUser && (
        <View style={[styles.avatar, styles.avatarMine]}><Text style={styles.avatarText}>{getInitials(msg.senderName)}</Text></View>
      )}
    </View>
  )

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: connected ? COLORS.success : COLORS.warning }]} />
        <Text style={styles.statusText}>{connected ? 'Live' : 'Polling'}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading messages…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatIcon}>💬</Text>
              <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, paddingHorizontal: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: COLORS.textSecondary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  messageList: { padding: SPACING.md, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarMine: { backgroundColor: COLORS.primaryDark },
  avatarText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  bubbleWrap: { maxWidth: '70%' },
  senderName: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: RADIUS.lg, padding: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, ...SHADOW.sm },
  bubbleSending: { opacity: 0.7 },
  msgText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 20 },
  msgTextMine: { color: COLORS.white },
  msgTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, textAlign: 'right' },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 8 },
  emptyChatIcon: { fontSize: 48 },
  emptyChatText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  chatInput: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendIcon: { fontSize: 18, color: COLORS.white },
})
