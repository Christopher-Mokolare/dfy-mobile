import React, { useCallback, useState } from 'react'
import {
  View, Text, TextInput, ScrollView, StyleSheet, Alert, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { bankingApi, authApi } from '../../api'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import { LoadingScreen, EmptyState } from '../../components/Common'
import Button from '../../components/Button'
import { COLORS, RADIUS, SPACING, SHADOW } from '../../config/theme'
import type { BankAccount, SupportedBank } from '../../types'

const maskAccountNumber = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? `•••• ${digits.slice(-4)}` : 'Account number unavailable'
}

type ProfileSecurity = {
  hasGoogleLogin: boolean
  authenticatorTwoFactorEnabled: boolean
}

type StepUpOperation = {
  label: string
  execute: (token: string) => Promise<void>
}

export default function BankAccountsScreen() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [banks, setBanks] = useState<SupportedBank[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<SupportedBank | null>(null)
  const [form, setForm] = useState({ accountNumber: '', accountHolderName: '', accountType: 'Savings' })
  const [profileSecurity, setProfileSecurity] = useState<ProfileSecurity | null>(null)
  const [stepUpVisible, setStepUpVisible] = useState(false)
  const [stepUpPassword, setStepUpPassword] = useState('')
  const [stepUpCode, setStepUpCode] = useState('')
  const [stepUpGoogleToken, setStepUpGoogleToken] = useState<string | null>(null)
  const [stepUpError, setStepUpError] = useState('')
  const [stepUpLoading, setStepUpLoading] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<StepUpOperation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [accountsResult, banksResult, profileResult] = await Promise.allSettled([
      bankingApi.getBankAccounts(),
      bankingApi.getBanks(),
      authApi.getProfile(),
    ])

    if (accountsResult.status === 'fulfilled') {
      setAccounts(accountsResult.value.data?.data || [])
    } else {
      setAccounts([])
      Alert.alert('Bank accounts unavailable', accountsResult.reason?.response?.data?.message || 'Unable to load your bank accounts.')
    }

    if (banksResult.status === 'fulfilled') {
      setBanks(banksResult.value.data?.data || [])
    } else {
      setBanks([])
      Alert.alert('Bank list unavailable', banksResult.reason?.response?.data?.message || 'Unable to load supported banks.')
    }

    if (profileResult.status === 'fulfilled') {
      const profile = profileResult.value.data?.data || profileResult.value.data
      if (profile) {
        setProfileSecurity({
          hasGoogleLogin: !!profile.hasGoogleLogin,
          authenticatorTwoFactorEnabled: !!profile.authenticatorTwoFactorEnabled,
        })
        setForm(previous => ({
          ...previous,
          accountHolderName: previous.accountHolderName ||
            [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(),
        }))
      } else {
        setProfileSecurity(null)
      }
    } else {
      setProfileSecurity(null)
    }
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const requestStepUp = (label: string, execute: (token: string) => Promise<void>) => {
    if (!profileSecurity) {
      Alert.alert('Account security unavailable', 'Reload this screen so DoForYou can confirm your sign-in method and authenticator settings before changing payout details.')
      return
    }
    setStepUpError('')
    setStepUpPassword('')
    setStepUpCode('')
    setStepUpGoogleToken(null)
    setPendingOperation({ label, execute })
    setStepUpVisible(true)
  }

  const completeStepUp = async (googleTokenOverride?: string) => {
    if (!profileSecurity || !pendingOperation || stepUpLoading) return
    const googleIdToken = googleTokenOverride || stepUpGoogleToken || undefined

    if (profileSecurity.hasGoogleLogin && !googleIdToken) {
      setStepUpError('Confirm your linked Google account to continue.')
      return
    }
    if (!profileSecurity.hasGoogleLogin && !stepUpPassword) {
      setStepUpError('Enter your current password to continue.')
      return
    }
    if (profileSecurity.authenticatorTwoFactorEnabled && !stepUpCode.trim()) {
      setStepUpError('Enter your authenticator or recovery code to continue.')
      return
    }

    setStepUpLoading(true)
    setStepUpError('')
    try {
      const response = await authApi.reauthenticate({
        currentPassword: profileSecurity.hasGoogleLogin ? undefined : stepUpPassword,
        googleIdToken: profileSecurity.hasGoogleLogin ? googleIdToken : undefined,
        secondFactorCode: profileSecurity.authenticatorTwoFactorEnabled ? stepUpCode.trim() : undefined,
      })
      const data = response.data?.data || response.data
      if (!response.data?.success || !data?.stepUpToken) {
        throw new Error(response.data?.message || 'Reauthentication could not be completed.')
      }
      const operation = pendingOperation
      setStepUpVisible(false)
      setPendingOperation(null)
      setStepUpPassword('')
      setStepUpCode('')
      setStepUpGoogleToken(null)
      await operation.execute(data.stepUpToken as string)
    } catch (error: any) {
      setStepUpError(error.response?.data?.message || error.message || 'Reauthentication failed. Please try again.')
    } finally {
      setStepUpLoading(false)
    }
  }

  const addAccountAfterStepUp = async (token: string) => {
    if (!selected) return
    setSaving(true)
    try {
      const response = await bankingApi.addBankAccount({
        ...form,
        bankCode: selected.bankCode,
        bankGroupId: selected.bankCode,
        bankName: selected.name,
        branchCode: selected.branchCode,
      }, token)
      if (!response.data?.success) {
        Alert.alert('Bank account not verified', response.data?.message || 'The provider did not verify this account. The account has not been marked payout-ready.')
        await load()
        return
      }
      Alert.alert('Bank account updated', response.data?.message || 'Bank account verification is complete.')
      setForm({ accountNumber: '', accountHolderName: '', accountType: 'Savings' })
      setSelected(null)
      await load()
    } catch (error: any) {
      Alert.alert('Unable to add bank account', error.response?.data?.message || 'Please review the details and try again.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!selected || !form.accountNumber.trim() || !form.accountHolderName.trim()) {
      Alert.alert('Required', 'Select a bank and complete the account holder and account number fields.')
      return
    }
    if (!/^\d{9,11}$/.test(form.accountNumber.trim())) {
      Alert.alert('Invalid account number', 'Enter a 9–11 digit South African bank account number.')
      return
    }
    requestStepUp('add this bank account', addAccountAfterStepUp)
  }

  const setDefaultAfterStepUp = async (id: number, token: string) => {
    try {
      const response = await bankingApi.setDefaultPayoutAccount(id, token)
      if (!response.data?.success) {
        Alert.alert('Unable to update default', response.data?.message || 'The account could not be selected.')
        await load()
        return
      }
      Alert.alert('Default payout updated', response.data?.message || 'New runner payouts will use this verified account.')
      await load()
    } catch (error: any) {
      Alert.alert('Unable to update default', error.response?.data?.message || 'Please try again.')
      await load()
    }
  }

  const setDefault = (id: number) =>
    requestStepUp('change the default payout account', token => setDefaultAfterStepUp(id, token))

  const retryVerificationAfterStepUp = async (id: number, token: string) => {
    try {
      const response = await bankingApi.retryVerification(id, token)
      if (!response.data?.success) {
        Alert.alert('Verification not complete', response.data?.message || 'The bank could not be verified.')
        await load()
        return
      }
      Alert.alert('Verification updated', response.data?.message || 'Bank verification status refreshed.')
      await load()
    } catch (error: any) {
      Alert.alert('Verification unavailable', error.response?.data?.message || 'Unable to retry bank verification.')
      await load()
    }
  }

  const retryVerification = (id: number) =>
    requestStepUp('retry bank verification', token => retryVerificationAfterStepUp(id, token))

  const removeAfterStepUp = async (id: number, token: string) => {
    try {
      const response = await bankingApi.removeBankAccount(id, token)
      if (!response.data?.success) {
        Alert.alert('Unable to remove', response.data?.message || 'The account could not be removed.')
        return
      }
      await load()
      Alert.alert('Account removed', 'The account is no longer available for new payouts.')
    } catch (error: any) {
      Alert.alert('Unable to remove', error.response?.data?.message || 'The account may be linked to a payout in progress.')
      await load()
    }
  }

  const removeAccount = (id: number) => Alert.alert(
    'Remove bank account?',
    'This removes the account from future payout settings. Any payout in progress may prevent removal.',
    [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => requestStepUp('remove this bank account', token => removeAfterStepUp(id, token)) },
    ],
  )

  if (loading) return <LoadingScreen message="Loading bank accounts..." />

  return (
    <>
      <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.title}>Bank Accounts</Text>
          <Text style={s.sub}>Verified accounts receive direct task payouts. Wallet withdrawals are retired.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Your accounts</Text>
          {accounts.length === 0
            ? <EmptyState icon="🏦" title="No bank account" subtitle="Add and verify a bank account for runner payouts." />
            : accounts.map(account => (
              <View key={account.id} style={s.account}>
                <Text style={s.bank}>{account.bankName}</Text>
                <Text style={s.meta}>{account.accountHolderName} · {maskAccountNumber(account.accountNumber)}</Text>
                <Text style={[s.verified, { color: account.isVerified ? COLORS.success : COLORS.danger }]}>
                  {account.isVerified ? '✓ Verified' : 'Not verified for payouts'}
                </Text>
                {!account.isVerified && account.verificationMessage ? <Text style={s.verificationMessage}>{account.verificationMessage}</Text> : null}
                {account.isDefaultPayout ? <Text style={s.defaultLabel}>Default payout account</Text> : null}
                <View style={s.accountActions}>
                  {!account.isDefaultPayout ? (
                    <TouchableOpacity
                      onPress={() => account.isVerified ? setDefault(account.id) : retryVerification(account.id)}
                      style={[s.defaultAction, s.actionButton]}
                      accessibilityRole="button"
                      disabled={saving}
                    >
                      <Text style={s.defaultActionText}>{account.isVerified ? 'Set as default payout' : 'Retry verification'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => removeAccount(account.id)}
                    style={[s.removeAction, s.actionButton]}
                    accessibilityRole="button"
                    disabled={saving}
                  >
                    <Text style={s.removeActionText}>Remove account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>

        <View style={s.card}>
          <Text style={s.heading}>Add account</Text>
          <Text style={s.label}>Bank</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chips}>
              {banks.map(bank => (
                <TouchableOpacity
                  key={bank.bankCode}
                  onPress={() => setSelected(bank)}
                  style={[s.chip, selected?.bankCode === bank.bankCode && s.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selected?.bankCode === bank.bankCode }}
                >
                  <Text style={[s.chipText, selected?.bankCode === bank.bankCode && s.chipTextActive]}>{bank.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={s.label}>Account holder</Text>
          <TextInput style={s.input} value={form.accountHolderName} onChangeText={value => setForm(current => ({ ...current, accountHolderName: value }))} autoComplete="name" />
          <Text style={s.label}>Account number</Text>
          <TextInput style={s.input} value={form.accountNumber} onChangeText={value => setForm(current => ({ ...current, accountNumber: value.replace(/\D/g, '') }))} keyboardType="numeric" maxLength={11} autoComplete="off" />
          <Text style={s.label}>Account type</Text>
          <TextInput style={s.input} value={form.accountType} onChangeText={value => setForm(current => ({ ...current, accountType: value }))} />
          <Button title="Add & Verify Account" onPress={save} loading={saving} fullWidth style={{ marginTop: 8 }} />
        </View>
      </ScrollView>

      <Modal visible={stepUpVisible} transparent animationType="fade" onRequestClose={() => { if (!stepUpLoading) { setStepUpVisible(false); setPendingOperation(null) } }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalEyebrow}>ACCOUNT SECURITY</Text>
            <Text style={s.modalTitle}>Confirm it’s you</Text>
            <Text style={s.modalText}>
              Reauthenticate before you {pendingOperation?.label || 'change payout settings'}. This authorization can be used once and expires after five minutes.
            </Text>
            {!!stepUpError && <Text style={s.modalError} accessibilityRole="alert">{stepUpError}</Text>}

            {profileSecurity?.hasGoogleLogin ? (
              <GoogleSignInButton
                onIdToken={token => {
                  setStepUpGoogleToken(token)
                  void completeStepUp(token)
                }}
                disabled={stepUpLoading}
              />
            ) : (
              <>
                <Text style={s.label}>Current password</Text>
                <TextInput
                  style={s.input}
                  value={stepUpPassword}
                  onChangeText={setStepUpPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="Confirm your current password"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!stepUpLoading}
                />
              </>
            )}

            {profileSecurity?.authenticatorTwoFactorEnabled ? (
              <>
                <Text style={s.label}>Authenticator or recovery code</Text>
                <TextInput
                  style={s.input}
                  value={stepUpCode}
                  onChangeText={setStepUpCode}
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  maxLength={20}
                  placeholder="Enter your current code"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!stepUpLoading}
                />
              </>
            ) : null}

            {(!profileSecurity?.hasGoogleLogin || (profileSecurity.authenticatorTwoFactorEnabled && !!stepUpGoogleToken)) ? (
              <Button
                title={stepUpLoading ? 'Verifying…' : 'Verify and continue'}
                onPress={() => { void completeStepUp() }}
                loading={stepUpLoading}
                disabled={stepUpLoading ||
                  (!profileSecurity?.hasGoogleLogin && !stepUpPassword) ||
                  (!!profileSecurity?.authenticatorTwoFactorEnabled && !stepUpCode.trim())}
                fullWidth
                style={{ marginTop: 12 }}
              />
            ) : null}
            <Button
              title="Cancel"
              onPress={() => { setStepUpVisible(false); setPendingOperation(null) }}
              variant="secondary"
              disabled={stepUpLoading}
              fullWidth
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 32 },
  header: { backgroundColor: COLORS.primary, padding: SPACING.lg },
  title: { fontSize: 26, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 14, color: 'rgba(255,255,255,.85)', marginTop: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, margin: SPACING.md, ...SHADOW.sm },
  heading: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  account: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 12 },
  accountActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  actionButton: { flex: 1, alignSelf: 'auto', justifyContent: 'center', alignItems: 'center', minHeight: 40 },
  bank: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  verified: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  verificationMessage: { fontSize: 12, lineHeight: 17, color: COLORS.textSecondary, marginTop: 4 },
  defaultLabel: { fontSize: 12, fontWeight: '700', color: COLORS.success, marginTop: 6 },
  defaultAction: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary },
  defaultActionText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  removeAction: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger },
  removeActionText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.58)', justifyContent: 'center', padding: SPACING.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  modalEyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 5 },
  modalText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginVertical: 10 },
  modalError: { color: COLORS.danger, fontSize: 13, lineHeight: 18, marginBottom: 8 },
})
