import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TextInput, StyleSheet, Modal,
  TouchableOpacity, Alert, Switch
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { tasksApi, categoryApi, taskConfigurationApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/Button'
import { AlertBanner } from '../../components/Common'
import { COLORS, RADIUS, SPACING, SHADOW } from '../../config/theme'

const DEFAULT_CATEGORIES = ['Grocery Shopping','Delivery','Cleaning','Gardening','Moving','Repairs','Tutoring','Pet Care','Cooking','Other']

function calcCommission(budget: number) {
  // Match the web app and backend: 15% with a R5 minimum fee.
  const commission = budget > 0 ? Math.max(budget * 0.15, 5) : 0
  return { total: budget, commission, payout: budget - commission }
}


function DateTimePickerField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parseValue = (raw: string) => {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!match) return new Date()
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
  }
  const [visible, setVisible] = useState(false)
  const [month, setMonth] = useState(() => {
    const d = value ? parseValue(value) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => value ? parseValue(value) : new Date(Date.now() + 86400000))
  const [time, setTime] = useState(() => value ? value.slice(11, 16) : '14:00')
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const offset = new Date(year, monthIndex, 1).getDay()
  const dayCells = [...Array(offset).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)]
  const today = new Date()
  const chooseDay = (day: number) => setSelected(new Date(year, monthIndex, day, selected.getHours(), selected.getMinutes()))
  const formatted = value ? value.replace('T', ' ') : 'Select date and time'
  const commit = () => {
    const [hours, minutes] = time.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return
    const d = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hours, minutes)
    const pad = (n: number) => String(n).padStart(2, '0')
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    setVisible(false)
  }
  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={() => { const d = value ? parseValue(value) : new Date(Date.now() + 86400000); setSelected(d); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setTime(value ? value.slice(11, 16) : '14:00'); setVisible(true) }} accessibilityRole="button" accessibilityLabel="Choose task deadline">
        <Text style={[pickerStyles.triggerText, !value && pickerStyles.placeholder]}>{formatted}</Text>
        <Text style={pickerStyles.triggerIcon}>▦</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.modal}>
            <Text style={pickerStyles.title}>Choose deadline</Text>
            <View style={pickerStyles.monthRow}>
              <TouchableOpacity onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} style={pickerStyles.monthButton}><Text style={pickerStyles.monthButtonText}>‹</Text></TouchableOpacity>
              <Text style={pickerStyles.monthLabel}>{month.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} style={pickerStyles.monthButton}><Text style={pickerStyles.monthButtonText}>›</Text></TouchableOpacity>
            </View>
            <View style={pickerStyles.weekRow}>{['S','M','T','W','T','F','S'].map((d, i) => <Text key={i} style={pickerStyles.weekDay}>{d}</Text>)}</View>
            <View style={pickerStyles.calendarGrid}>
              {dayCells.map((day, i) => {
                if (!day) return <View key={`blank-${i}`} style={pickerStyles.dayCell} />
                const active = selected.getFullYear() === year && selected.getMonth() === monthIndex && selected.getDate() === day
                const date = new Date(year, monthIndex, day)
                const tooOld = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                return <TouchableOpacity key={day} disabled={tooOld} onPress={() => chooseDay(day)} style={[pickerStyles.dayCell, active && pickerStyles.daySelected, tooOld && pickerStyles.dayDisabled]}><Text style={[pickerStyles.dayText, active && pickerStyles.dayTextSelected, tooOld && pickerStyles.dayTextDisabled]}>{day}</Text></TouchableOpacity>
              })}
            </View>
            <Text style={pickerStyles.timeLabel}>Time (24-hour)</Text>
            <TextInput style={pickerStyles.timeInput} value={time} onChangeText={setTime} placeholder="14:00" keyboardType="numbers-and-punctuation" maxLength={5} />
            <View style={pickerStyles.actions}>
              <TouchableOpacity onPress={() => setVisible(false)} style={pickerStyles.cancel}><Text style={pickerStyles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={commit} style={pickerStyles.confirm}><Text style={pickerStyles.confirmText}>Use deadline</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const pickerStyles = StyleSheet.create({
  trigger: { minHeight: 48, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white },
  triggerText: { color: COLORS.textPrimary, fontSize: 15 },
  placeholder: { color: COLORS.textMuted },
  triggerIcon: { color: COLORS.primaryDark, fontSize: 21, marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(20,16,12,0.5)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18, maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthButtonText: { color: COLORS.primaryDark, fontSize: 26, fontWeight: '700' },
  monthLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDay: { width: '13.5%', textAlign: 'center', color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  daySelected: { backgroundColor: COLORS.primary },
  dayDisabled: { opacity: 0.35 },
  dayText: { color: COLORS.textPrimary, fontSize: 14 },
  dayTextSelected: { color: COLORS.white, fontWeight: '800' },
  dayTextDisabled: { color: COLORS.textMuted },
  timeLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  timeInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 11, color: COLORS.textPrimary, fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancel: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  confirm: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmText: { color: COLORS.white, fontWeight: '800' },
})

export default function PostErrandScreen({ navigation, route }: any) {
  const { user, canPostErrands, isAuthenticated } = useAuth()
  const editId = route?.params?.editId
  const isEdit = !!editId

  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pendingScrollField, setPendingScrollField] = useState('')
  const scrollRef = useRef<ScrollView>(null)
  const fieldPositions = useRef<Record<string, number>>({})
  const [budgetLimits, setBudgetLimits] = useState<{ minimumBudget: number; maximumBudget: number; currency: string } | null>(null)
  const [form, setForm] = useState({
    taskName: '', taskDescription: '', category: '', customCategory: '', area: '',
    priority: 'standard', dateNeeded: '', budget: '', notes: '',
    termsAccepted: false,
  })

  useEffect(() => {
    if (!isAuthenticated() || !canPostErrands()) {
      navigation.navigate('Dashboard')
      return
    }
    taskConfigurationApi.getTaskLimits().then(r => {
      const limits = r.data?.data
      if (!limits || !Number.isFinite(limits.minimumBudget) || !Number.isFinite(limits.maximumBudget) || limits.minimumBudget > limits.maximumBudget) {
        throw new Error('Invalid task budget limits response.')
      }
      setBudgetLimits(limits)
    }).catch(() => setError('Unable to load task budget limits. Please try again later.'))
    categoryApi.getAll().then(r => {
      const cats = r.data?.data || r.data
      if (Array.isArray(cats) && cats.length)
        setCategories([...cats.map((c: any) => c.name || c), 'Other'])
    }).catch(() => {})

    if (editId) {
      tasksApi.getById(editId).then(r => {
        const t = r.data?.data || r.data
        if (t) setForm(f => ({
          ...f,
          taskName: t.taskName || t.title || '',
          taskDescription: t.taskDescription || t.description || '',
          category: t.category || '',
          customCategory: '',
          area: t.area || t.location || '',
          priority: t.priority || 'standard',
          dateNeeded: (t.dateNeeded || t.dueDate) ? (t.dateNeeded || t.dueDate).substring(0, 16) : '',
          budget: String(t.budget || ''),
          notes: t.notes || '',
        }))
      }).catch(() => {})
    }
  }, [editId])

  const validateForm = () => {
    const amount = Number(form.budget)
    const date = form.dateNeeded ? new Date(form.dateNeeded) : null
    const now = new Date()
    const next: Record<string, string> = {}
    const name = form.taskName.trim()
    const description = form.taskDescription.trim()
    const category = form.category === 'Other' ? form.customCategory.trim() : form.category.trim()
    if (!name) next.taskName = 'Enter a task name.'
    else if (name.length > 60) next.taskName = 'Task name must be 60 characters or fewer.'
    if (!description) next.taskDescription = 'Describe what needs to be done.'
    else if (description.length < 20) next.taskDescription = `Add more detail (at least 20 characters; currently ${description.length}).`
    else if (description.length > 500) next.taskDescription = 'Description must be 500 characters or fewer.'
    if (!form.category.trim()) next.category = 'Choose a category.'
    else if (form.category === 'Other' && !category) next.customCategory = 'Enter a custom category.'
    else if (form.category === 'Other' && category.length > 80) next.customCategory = 'Custom category must be 80 characters or fewer.'
    if (form.area.trim().length < 2) next.area = 'Enter an area or suburb (at least 2 characters).'
    if (!form.dateNeeded || !date || Number.isNaN(date.getTime())) next.dateNeeded = 'Choose a valid deadline.'
    else if (date.getTime() <= now.getTime() + 30 * 60 * 1000) next.dateNeeded = 'Deadline must be at least 30 minutes from now.'
    else if (date.getTime() > now.getTime() + 365 * 24 * 60 * 60 * 1000) next.dateNeeded = 'Deadline cannot be more than 365 days away.'
    if (!form.budget.trim() || !Number.isFinite(amount)) next.budget = 'Enter a valid budget amount.'
    else if (!budgetLimits) next.budget = 'Task budget limits are unavailable. Please try again.'
    else if (amount < budgetLimits.minimumBudget) next.budget = `Budget must be at least R${budgetLimits.minimumBudget}.`
    else if (amount > budgetLimits.maximumBudget) next.budget = `Budget cannot exceed R${budgetLimits.maximumBudget}.`
    if (!form.termsAccepted) next.termsAccepted = 'Accept the Terms & Conditions to continue.'
    return next
  }

  const fieldStep: Record<string, number> = {
    taskName: 1, taskDescription: 1, category: 1, customCategory: 1, area: 1,
    dateNeeded: 2, budget: 2, termsAccepted: 3,
  }

  const validateStep = (targetStep: number) => {
    const allErrors = validateForm()
    const fieldsForStep = Object.keys(allErrors).filter(field => fieldStep[field] === targetStep)
    setTouched(current => ({ ...current, ...Object.fromEntries(fieldsForStep.map(field => [field, true])) }))
    setFieldErrors(allErrors)
    if (fieldsForStep.length) {
      setPendingScrollField(fieldsForStep[0])
      return false
    }
    return true
  }

  useEffect(() => {
    if (!pendingScrollField) return
    const position = fieldPositions.current[pendingScrollField]
    if (position != null) scrollRef.current?.scrollTo({ y: Math.max(position + 240, 0), animated: true })
    setPendingScrollField('')
  }, [step, pendingScrollField])

  const isFieldInvalid = (field: string) => !!touched[field] && !!fieldErrors[field]
  const fieldHint = (field: string) => isFieldInvalid(field)
    ? <Text accessibilityRole="alert" style={styles.fieldError}>{fieldErrors[field]}</Text>
    : null

  const set = (field: string) => (val: string | boolean) => {
    setForm(f => ({ ...f, [field]: val }))
    if (touched[field]) {
      const updated = { ...form, [field]: val }
      // Validate the edited field immediately after it has been touched.
      const amount = Number(updated.budget)
      const date = updated.dateNeeded ? new Date(updated.dateNeeded) : null
      const now = new Date()
      let message = ''
      if (field === 'taskName') {
        const value = String(val).trim()
        message = !value ? 'Enter a task name.' : value.length > 60 ? 'Task name must be 60 characters or fewer.' : ''
      } else if (field === 'taskDescription') {
        const value = String(val).trim()
        message = !value ? 'Describe what needs to be done.' : value.length < 20 ? `Add more detail (at least 20 characters; currently ${value.length}).` : value.length > 500 ? 'Description must be 500 characters or fewer.' : ''
      } else if (field === 'category') {
        message = !String(val).trim() ? 'Choose a category.' : ''
      } else if (field === 'customCategory') {
        const value = String(val).trim()
        message = updated.category === 'Other' && !value ? 'Enter a custom category.' : value.length > 80 ? 'Custom category must be 80 characters or fewer.' : ''
      } else if (field === 'area') {
        message = String(val).trim().length < 2 ? 'Enter an area or suburb (at least 2 characters).' : ''
      } else if (field === 'dateNeeded') {
        message = !date || Number.isNaN(date.getTime()) ? 'Choose a valid deadline.' : date.getTime() <= now.getTime() + 30 * 60 * 1000 ? 'Deadline must be at least 30 minutes from now.' : date.getTime() > now.getTime() + 365 * 24 * 60 * 60 * 1000 ? 'Deadline cannot be more than 365 days away.' : ''
      } else if (field === 'budget') {
        message = !String(val).trim() || !Number.isFinite(amount) ? 'Enter a valid budget amount.' : !budgetLimits ? 'Task budget limits are unavailable. Please try again.' : amount < budgetLimits.minimumBudget ? `Budget must be at least R${budgetLimits.minimumBudget}.` : amount > budgetLimits.maximumBudget ? `Budget cannot exceed R${budgetLimits.maximumBudget}.` : ''
      } else if (field === 'termsAccepted') {
        message = val ? '' : 'Accept the Terms & Conditions to continue.'
      }
      setFieldErrors(current => ({ ...current, [field]: message }))
    }
  }

  const budget = parseFloat(form.budget) || 0
  const commission = calcCommission(budget)

  const handleSubmit = async () => {
    const validation = validateForm()
    setFieldErrors(validation)
    setTouched({
      taskName: true, taskDescription: true, category: true, customCategory: true,
      area: true, dateNeeded: true, budget: true, termsAccepted: true,
    })
    const firstInvalid = Object.keys(validation)[0]
    if (firstInvalid) {
      const targetStep = fieldStep[firstInvalid] || 1
      setPendingScrollField(firstInvalid)
      if (step !== targetStep) setStep(targetStep)
      else {
        const position = fieldPositions.current[firstInvalid]
        if (position != null) scrollRef.current?.scrollTo({ y: Math.max(position + 240, 0), animated: true })
      }
      setError('Please fix the highlighted field' + (Object.keys(validation).length > 1 ? 's' : '') + ' before continuing.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const payload = {
        taskName: form.taskName.trim(),
        taskDescription: form.taskDescription.trim(),
        category: form.category === 'Other' ? form.customCategory.trim() : form.category.trim(),
        area: form.area.trim(),
        priority: form.priority,
        dateNeeded: form.dateNeeded,
        budget: parseFloat(form.budget),
        notes: form.notes.trim(),
        termsAccepted: form.termsAccepted,
      }
      const res = isEdit
        ? await tasksApi.update(editId!, payload)
        : await tasksApi.create(payload)

      const data = res.data
      if (data.success !== false) {
        const payUrl = data.data?.paymentUrl

        if (payUrl) {
          // Use an auth session so the Paystack callback can deep-link back into
          // the installed app and close the browser. A redirect is not proof of payment:
          // the backend webhook and task API remain authoritative.
          const returnUrl = 'doforyou://payment-return'
          const checkoutResult = await WebBrowser.openAuthSessionAsync(payUrl, returnUrl)
          navigation.navigate('MyPostedTasks')
          if (checkoutResult.type === 'success') {
            Alert.alert(
              'Checking payment status',
              'You have returned to DoForYou. Your task will show as paid only after the backend verifies the payment.'
            )
          } else {
            Alert.alert(
              'Checkout closed',
              'Your payment may still be processing. Check your posted tasks before trying to pay again.'
            )
          }
        } else {
          Alert.alert('Success!', isEdit ? 'Task updated.' : 'Task created!', [
            { text: 'View Tasks', onPress: () => navigation.navigate('MyPostedTasks') }
          ])
        }
      } else {
        setError(data.message || 'Failed to create task.')
      }
    } catch (err: any) {
      const body = err.response?.data
      const validationErrors = body?.errors && typeof body.errors === 'object'
        ? Object.values(body.errors).flat().filter(Boolean).join(' ')
        : ''
      setError(validationErrors || body?.message || body?.title || 'Failed to submit task. Please check the details and try again.')
    } finally { setSubmitting(false) }
  }

  const STEPS = ['Details', 'Budget & Date', 'Review']

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>✨</Text>
        <Text style={styles.heroTitle}>{isEdit ? 'Edit Your Task' : 'Create Your Task'}</Text>
        <Text style={styles.heroSub}>{isEdit ? 'Update your task details' : 'Transform your to-do into someone else\'s opportunity'}</Text>
        {user && (
          <View style={styles.userWelcome}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(user.firstName || user.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>
                {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.name}
              </Text>
              <Text style={styles.userContact}>{user.contact || user.phoneNumber || user.email}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Step indicator */}
      <View style={styles.stepsRow}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, step > i + 1 && styles.stepDone, step === i + 1 && styles.stepActive]}>
              <Text style={[styles.stepNum, step >= i + 1 && styles.stepNumActive]}>
                {step > i + 1 ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      {error ? <AlertBanner type="error" message={error} /> : null}

      <View style={styles.card}>
        {/* Step 1 */}
        {step === 1 && (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>📋 What do you need done?</Text>

            <View onLayout={event => { fieldPositions.current.taskName = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Task Name * <Text style={styles.hint}>(max 60 chars)</Text></Text>
              <TextInput
                style={[styles.input, isFieldInvalid('taskName') && styles.inputInvalid]}
                value={form.taskName}
                onChangeText={set('taskName')}
                placeholder="e.g. Car Wash Vereeniging, Grocery Run Sandton"
                placeholderTextColor={COLORS.textMuted}
                maxLength={60}
                onBlur={() => { setTouched(current => ({ ...current, taskName: true })); setFieldErrors(validateForm()) }}
              />
              <Text style={styles.charCount}>{form.taskName.length}/60</Text>
              {fieldHint('taskName')}
            </View>

            <View onLayout={event => { fieldPositions.current.taskDescription = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Describe your task *</Text>
              <TextInput
                style={[styles.input, styles.textarea, isFieldInvalid('taskDescription') && styles.inputInvalid]}
                value={form.taskDescription}
                onChangeText={set('taskDescription')}
                placeholder="Tell us what you need help with..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                onBlur={() => { setTouched(current => ({ ...current, taskDescription: true })); setFieldErrors(validateForm()) }}
              />
              <Text style={styles.hint}>Be specific — the more details, the better matches! Use 20–500 characters. {form.taskDescription.trim().length}/500</Text>
              {fieldHint('taskDescription')}
            </View>

            <View onLayout={event => { fieldPositions.current.category = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.catRow}>
                  {categories.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catChip, form.category === c && styles.catChipActive]}
                      onPress={() => { set('category')(c); setTouched(current => ({ ...current, category: true, customCategory: true })); setFieldErrors(current => ({ ...current, category: '', customCategory: c === 'Other' && !form.customCategory.trim() ? 'Enter a custom category.' : '' })) }}
                    >
                      <Text style={[styles.catChipText, form.category === c && styles.catChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {form.category === 'Other' && (
                <TextInput
                  style={[styles.input, { marginTop: 10 }, isFieldInvalid('customCategory') && styles.inputInvalid]}
                  value={form.customCategory}
                  onChangeText={set('customCategory')}
                  placeholder="Enter custom category..."
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={80}
                  onBlur={() => { setTouched(current => ({ ...current, customCategory: true })); setFieldErrors(validateForm()) }}
                />
              )}
              {fieldHint(form.category === 'Other' ? 'customCategory' : 'category')}
            </View>

            <View onLayout={event => { fieldPositions.current.area = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={[styles.input, isFieldInvalid('area') && styles.inputInvalid]}
                value={form.area}
                onChangeText={set('area')}
                placeholder="Area / Suburb"
                placeholderTextColor={COLORS.textMuted}
                onBlur={() => { setTouched(current => ({ ...current, area: true })); setFieldErrors(validateForm()) }}
              />
              {fieldHint('area')}
            </View>

            <View>
              <Text style={styles.label}>Urgency *</Text>
              <View style={styles.priorityRow}>
                {[
                  { v: 'standard', icon: '⏰', label: 'Standard', sub: '48 hours' },
                  { v: 'urgent', icon: '⚡', label: 'Urgent', sub: '24 hours' },
                ].map(p => (
                  <TouchableOpacity
                    key={p.v}
                    style={[styles.priorityCard, form.priority === p.v && styles.priorityCardActive]}
                    onPress={() => set('priority')(p.v)}
                  >
                    <Text style={styles.priorityIcon}>{p.icon}</Text>
                    <Text style={[styles.priorityLabel, form.priority === p.v && styles.priorityLabelActive]}>{p.label}</Text>
                    <Text style={styles.prioritySub}>{p.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Next →"
              onPress={() => { if (validateStep(1)) setStep(2) }}
              fullWidth size="lg"
            />
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>📅 When & How Much?</Text>

            <View onLayout={event => { fieldPositions.current.dateNeeded = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Deadline *</Text>
              <DateTimePickerField value={form.dateNeeded} onChange={value => { set('dateNeeded')(value); setTouched(current => ({ ...current, dateNeeded: true })); const date = value ? new Date(value) : null; const now = new Date(); const message = !date || Number.isNaN(date.getTime()) ? 'Choose a valid deadline.' : date.getTime() <= now.getTime() + 30 * 60 * 1000 ? 'Deadline must be at least 30 minutes from now.' : date.getTime() > now.getTime() + 365 * 24 * 60 * 60 * 1000 ? 'Deadline cannot be more than 365 days away.' : ''; setFieldErrors(current => ({ ...current, dateNeeded: message })) }} />
              {fieldHint('dateNeeded')}
            </View>

            <View onLayout={event => { fieldPositions.current.budget = event.nativeEvent.layout.y }}>
              <Text style={styles.label}>Your Budget (R) *</Text>
              <Text style={styles.hint}>{budgetLimits ? `R${budgetLimits.minimumBudget} minimum · R${budgetLimits.maximumBudget} maximum` : 'Loading budget limits…'}</Text>
              <View style={styles.budgetRow}>
                <View style={styles.currencyPrefix}>
                  <Text style={styles.currencyText}>R</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }, isFieldInvalid('budget') && styles.inputInvalid]}
                  value={form.budget}
                  onChangeText={set('budget')}
                  placeholder="100.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  onBlur={() => { setTouched(current => ({ ...current, budget: true })); setFieldErrors(current => ({ ...current, ...validateForm() })) }}
                />
              </View>
              {fieldHint('budget')}
            </View>

            {budgetLimits && budget >= budgetLimits.minimumBudget && (
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Task Budget:</Text>
                  <Text style={styles.breakdownValue}>R{commission.total.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>DFY platform fee (15%):</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.danger }]}>-R{commission.commission.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Runner payout:</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.primary }]}>R{commission.payout.toFixed(2)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Text style={[styles.breakdownLabel, { fontWeight: '700' }]}>You pay:</Text>
                  <Text style={[styles.breakdownValue, { fontWeight: '700' }]}>R{commission.total.toFixed(2)}</Text>
                </View>
                <Text style={styles.hint}>The DFY fee is deducted from the task budget. No separate platform fee is added at checkout.</Text>
              </View>
            )}

            <View style={styles.navRow}>
              <Button title="← Previous" onPress={() => setStep(1)} variant="secondary" style={{ flex: 1 }} />
              <Button title="Next →" onPress={() => { if (validateStep(2)) setStep(3) }} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>🚀 Final Details</Text>

            <View>
              <Text style={styles.label}>Anything else? (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.notes}
                onChangeText={set('notes')}
                placeholder="Special requirements, preferences..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>

            <View onLayout={event => { fieldPositions.current.termsAccepted = event.nativeEvent.layout.y }} style={styles.termsRow}>
              <Switch
                value={form.termsAccepted}
                onValueChange={value => { set('termsAccepted')(value); setTouched(current => ({ ...current, termsAccepted: true })); setFieldErrors(current => ({ ...current, termsAccepted: value ? '' : 'Accept the Terms & Conditions to continue.' })) }}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
              <Text style={styles.termsText}>I agree to the Terms & Conditions</Text>
            </View>
            {fieldHint('termsAccepted')}

            <View style={styles.paymentInfo}>
              <Text style={styles.paymentInfoTitle}>🔒 Secure Paystack payment</Text>
              <Text style={styles.paymentInfoSub}>Secure hosted checkout • Payment verified by DoForYou</Text>
              <Text style={styles.paymentInfoNote}>Your task becomes live only after payment is verified.</Text>
            </View>

            <View style={styles.navRow}>
              <Button title="← Previous" onPress={() => setStep(2)} variant="secondary" style={{ flex: 1 }} />
              <Button
                title={isEdit ? 'Save Changes' : '🚀 Launch My Task'}
                onPress={handleSubmit}
                loading={submitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  hero: { backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: 24, paddingBottom: 32, alignItems: 'center' },
  heroIcon: { fontSize: 36, marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: COLORS.white, marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  userWelcome: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.lg, padding: 12 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  userName: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  userContact: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepActive: { backgroundColor: COLORS.primary },
  stepDone: { backgroundColor: COLORS.success },
  stepNum: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  stepNumActive: { color: COLORS.white },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '600' },
  card: { margin: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.sm },
  stepTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.textMuted, fontWeight: '400' },
  inputInvalid: { borderColor: COLORS.danger, borderWidth: 2 },
  fieldError: { color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: 5 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  textarea: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 2 },
  catRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, color: COLORS.textSecondary },
  catChipTextActive: { color: COLORS.white, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityCard: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', gap: 4 },
  priorityCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  priorityIcon: { fontSize: 20 },
  priorityLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  priorityLabelActive: { color: COLORS.primary },
  prioritySub: { fontSize: 11, color: COLORS.textMuted },
  budgetRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { backgroundColor: COLORS.backgroundDark, borderWidth: 1.5, borderColor: COLORS.border, borderRightWidth: 0, borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md, padding: 12, justifyContent: 'center' },
  currencyText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  breakdown: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 14, gap: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  breakdownLabel: { fontSize: 14, color: COLORS.textSecondary },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  navRow: { flexDirection: 'row', gap: 10 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  termsText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  paymentInfo: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', gap: 4 },
  paymentInfoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
  paymentInfoSub: { fontSize: 13, color: COLORS.primaryDark, textAlign: 'center' },
  paymentInfoNote: { fontSize: 11, color: COLORS.primaryDark, textAlign: 'center', marginTop: 4 },
})
