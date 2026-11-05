import SignOutButton from '../../components/SignOutButton'
import React, { useState, useEffect } from 'react'
import { AppState, Linking, View, Text, ScrollView, TextInput, StyleSheet, Alert, TouchableOpacity, Switch } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { authApi, identityVerificationApi, userPreferencesApi } from '../../api'
import Button from '../../components/Button'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import { COLORS, RADIUS, SPACING, SHADOW } from '../../config/theme'

const USER_TYPES = [
  { value: 'creator', label: '📋 Task Creator', desc: 'Post tasks and hire helpers' },
  { value: 'runner', label: '🏃 Task Runner', desc: 'Find and complete tasks to earn' },
  { value: 'both', label: '🤝 Both', desc: 'Full access to post and complete tasks' },
]

const IDENTITY_VERIFICATION_CONSENT_VERSION = 'identity-verification-v1'
const IDENTITY_PRIVACY_URL = `${(process.env.EXPO_PUBLIC_DFY_WEB_URL || 'https://dfy-fe-staging.onrender.com').replace(/\/$/, '')}/privacy`

export default function ProfileScreen({ navigation }: any) {
  const { user, refreshUser, logout } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', userType: '', address: '' })
  const [hasIdNumber, setHasIdNumber] = useState(false)
  const [idNumberLastFour, setIdNumberLastFour] = useState('')
  const [hasPasswordLogin, setHasPasswordLogin] = useState(user?.hasPasswordLogin !== false)
  const [googleLinkIdToken, setGoogleLinkIdToken] = useState('')
  const [googleLinkPassword, setGoogleLinkPassword] = useState('')
  const [googleLinkSecondFactor, setGoogleLinkSecondFactor] = useState('')
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false)
  const [googleLinkError, setGoogleLinkError] = useState('')
  const [googleLinkMessage, setGoogleLinkMessage] = useState('')
  const [passwordSetupLoading, setPasswordSetupLoading] = useState(false)
  const [passwordSetupMessage, setPasswordSetupMessage] = useState('')
  const [passwordSetupError, setPasswordSetupError] = useState('')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [marketingConsentSaving, setMarketingConsentSaving] = useState(false)
  const [identityVerificationStatus, setIdentityVerificationStatus] = useState('not_started')
  const [identityProviderConfigured, setIdentityProviderConfigured] = useState(false)
  const [identityAttemptsRemaining, setIdentityAttemptsRemaining] = useState(0)
  const [identityConsentAccepted, setIdentityConsentAccepted] = useState(false)
  const [identitySessionLoading, setIdentitySessionLoading] = useState(false)
  const [identitySessionError, setIdentitySessionError] = useState('')
  const [authenticatorTwoFactorEnabled, setAuthenticatorTwoFactorEnabled] = useState(false)
  const [canAcceptTasks, setCanAcceptTasks] = useState(false)
  const [hasVerifiedPayoutAccount, setHasVerifiedPayoutAccount] = useState(false)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpConfigured, setTotpConfigured] = useState(false)
  const [totpRemainingCodes, setTotpRemainingCodes] = useState(0)
  const [totpSecret, setTotpSecret] = useState('')
  const [totpProvisioningUri, setTotpProvisioningUri] = useState('')
  const [totpCurrentPassword, setTotpCurrentPassword] = useState('')
  const [totpGoogleIdToken, setTotpGoogleIdToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpRecoveryCodes, setTotpRecoveryCodes] = useState<string[]>([])
  const [totpLoading, setTotpLoading] = useState(false)
  const [totpMessage, setTotpMessage] = useState('')
  const [totpError, setTotpError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [prefSaving, setPrefSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'type' | 'password' | 'security'>('info')

  useEffect(() => {
    authApi.getProfile().then(r => {
      const d = r.data?.data || r.data
      if (d) {
        setForm({
          firstName: d.firstName || '', lastName: d.lastName || '',
          email: d.email || '', phoneNumber: d.phoneNumber || d.contact || '',
          userType: d.userType || '',
          address: d.address || '',
        })
        setHasIdNumber(!!d.hasIdNumber)
        setIdNumberLastFour(d.idNumberLastFour || '')
        setHasPasswordLogin(d.hasPasswordLogin !== false)
        setMarketingConsent(!!d.marketingConsent)
        setIdentityVerificationStatus(d.identityVerificationStatus || 'not_started')
        setAuthenticatorTwoFactorEnabled(!!d.authenticatorTwoFactorEnabled)
        setCanAcceptTasks(!!d.canAcceptTasks)
        setHasVerifiedPayoutAccount(!!d.hasVerifiedPayoutAccount)
      }
    }).catch(() => {
      setHasIdNumber(false)
      setIdNumberLastFour('')
      setHasPasswordLogin(user?.hasPasswordLogin !== false)
      setMarketingConsent(!!user?.marketingConsent)
      if (user) setForm({
        firstName: user.firstName || '', lastName: user.lastName || '',
        email: user.email || '', phoneNumber: user.phoneNumber || user.contact || '',
        userType: user.userType || '',
        address: user.address || '',
      })
    })
  }, [user])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [profileResponse, statusResponse, twoFactorResponse] = await Promise.all([
          authApi.getProfile(),
          identityVerificationApi.getStatus(),
          authApi.getTwoFactorStatus(),
        ])
        if (!active) return
        const profile = profileResponse.data?.data || profileResponse.data
        const status = statusResponse.data?.data || statusResponse.data
        const twoFactor = twoFactorResponse.data?.data || twoFactorResponse.data
        if (profile) {
          // This refresh runs when the app returns to the foreground, including
          // after identity verification completed in an external browser or after
          // role/eligibility changes made on the website.
          setForm(prev => ({
            ...prev,
            firstName: profile.firstName || prev.firstName,
            lastName: profile.lastName || prev.lastName,
            email: profile.email || prev.email,
            phoneNumber: profile.phoneNumber || prev.phoneNumber,
            userType: profile.userType || prev.userType,
            address: profile.address || prev.address,
          }))
          setHasIdNumber(!!profile.hasIdNumber)
          setIdNumberLastFour(profile.idNumberLastFour || '')
          setHasPasswordLogin(profile.hasPasswordLogin !== false)
          setMarketingConsent(!!profile.marketingConsent)
          setIdentityVerificationStatus(profile.identityVerificationStatus || 'not_started')
          setAuthenticatorTwoFactorEnabled(!!profile.authenticatorTwoFactorEnabled)
          setCanAcceptTasks(!!profile.canAcceptTasks)
          setHasVerifiedPayoutAccount(!!profile.hasVerifiedPayoutAccount)
        }
        if (twoFactor) {
          setTotpEnabled(!!twoFactor.enabled)
          setTotpRemainingCodes(Number(twoFactor.remainingRecoveryCodes || 0))
          setTotpConfigured(!!twoFactor.encryptionConfigured)
        }
        if (status) {
          setIdentityProviderConfigured(!!status.configured)
          setIdentityAttemptsRemaining(Number(status.attemptsRemaining ?? 0))
        }
      } catch {
        if (active) {
          setIdentityProviderConfigured(false)
          setIdentityAttemptsRemaining(0)
        }
      }
    }
    void refresh()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh()
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    authApi.getTwoFactorStatus().then(response => {
      const d = response.data?.data || response.data
      if (d) {
        setTotpEnabled(!!d.enabled)
        setTotpRemainingCodes(Number(d.remainingRecoveryCodes || 0))
        setTotpConfigured(!!d.encryptionConfigured)
      }
    }).catch(() => setTotpConfigured(false))
  }, [])

  const set = (field: string) => (val: string) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    setLoading(true)
    try {
      await authApi.updateProfile(form)
      const r = await authApi.getProfile()
      const d = r.data?.data || r.data
      if (d) {
        setHasIdNumber(!!d.hasIdNumber)
        setIdNumberLastFour(d.idNumberLastFour || '')
        setHasPasswordLogin(d.hasPasswordLogin !== false)
        setMarketingConsent(!!d.marketingConsent)
        setIdentityVerificationStatus(d.identityVerificationStatus || 'not_started')
        setAuthenticatorTwoFactorEnabled(!!d.authenticatorTwoFactorEnabled)
        setCanAcceptTasks(!!d.canAcceptTasks)
        setHasVerifiedPayoutAccount(!!d.hasVerifiedPayoutAccount)
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        await AsyncStorage.setItem('currentUser', JSON.stringify(d))
        refreshUser()
      }
      Alert.alert('Success', 'Profile updated!')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.')
    } finally { setLoading(false) }
  }

  const requestPasswordSetup = async () => {
    setPasswordSetupLoading(true)
    setPasswordSetupMessage('')
    setPasswordSetupError('')
    try {
      const response = await authApi.forgotPassword(form.email.trim().toLowerCase())
      setPasswordSetupMessage(response.data?.message || 'If an account matches that email, password reset instructions will be sent shortly.')
    } catch {
      // Keep recovery responses neutral to avoid account enumeration.
      setPasswordSetupMessage('If an account matches that email, password reset instructions will be sent shortly.')
    } finally {
      setPasswordSetupLoading(false)
    }
  }

  const handleMarketingConsentChange = async (enabled: boolean) => {
    const previous = marketingConsent
    setMarketingConsent(enabled)
    setMarketingConsentSaving(true)
    try {
      const response = await authApi.updateMarketingConsent(enabled)
      if (response.data?.success === false) throw new Error(response.data?.message || 'Could not save your marketing preference.')
      const data = response.data?.data || response.data
      setMarketingConsent(Boolean(data?.enabled ?? enabled))
      Alert.alert('Marketing preference updated', enabled
        ? 'Optional marketing updates are enabled.'
        : 'Optional marketing updates have been turned off.')
    } catch (err: any) {
      setMarketingConsent(previous)
      Alert.alert('Could not save preference', err.response?.data?.message || err.message || 'Please try again.')
    } finally {
      setMarketingConsentSaving(false)
    }
  }

  const utf8ByteLength = (value: string) => Array.from(value).reduce((bytes, char) => {
    const codePoint = char.codePointAt(0) ?? 0
    return bytes + (codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4)
  }, 0)

  const handlePwChange = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return }
    if (pwForm.newPassword.length < 12 || pwForm.newPassword.length > 72 || utf8ByteLength(pwForm.newPassword) > 72) { Alert.alert('Error', 'Use a password between 12 and 72 characters and no more than 72 UTF-8 bytes.'); return }
    setPwLoading(true)
    try {
      await authApi.changePassword(pwForm)
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      await logout()
      navigation.navigate('Login')
      Alert.alert('Password changed', 'Sign in again with your new password.')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to change password.')
    } finally { setPwLoading(false) }
  }

  const startIdentityVerification = async () => {
    if (!identityConsentAccepted) {
      setIdentitySessionError('Accept the identity-verification notice before continuing.')
      return
    }
    if (!identityProviderConfigured) {
      setIdentitySessionError('Identity verification is not configured on this staging API yet.')
      return
    }
    setIdentitySessionLoading(true)
    setIdentitySessionError('')
    try {
      const response = await identityVerificationApi.createSession({
        consentAccepted: true,
        consentVersion: IDENTITY_VERIFICATION_CONSENT_VERSION,
      })
      const body = response.data
      const data = body?.data || body
      if (body?.success === false || !data?.handoffCode) {
        throw new Error(body?.message || 'The identity verification session could not be started.')
      }
      const webBase = process.env.EXPO_PUBLIC_DFY_WEB_URL || 'https://dfy-fe-staging.onrender.com'
      const url = `${webBase.replace(/\/$/, '')}/runner-verification#handoff=${encodeURIComponent(String(data.handoffCode))}`
      await Linking.openURL(url)
      Alert.alert(
        'Verification opened',
        'Complete the identity document and liveness steps in your browser. Return to DoForYou when finished; your runner eligibility will refresh from the backend.',
        [{ text: 'OK' }],
      )
    } catch (err: any) {
      setIdentitySessionError(err.response?.data?.message || err.message || 'The identity verification session could not be started.')
    } finally {
      setIdentitySessionLoading(false)
    }
  }

  const handleGoogleLink = async () => {
    setGoogleLinkError('')
    setGoogleLinkMessage('')
    if (!googleLinkIdToken) {
      setGoogleLinkError('Choose the Google account you want to link first.')
      return
    }
    if (!hasPasswordLogin || !googleLinkPassword) {
      setGoogleLinkError('Enter your current DoForYou password to approve this link.')
      return
    }

    setGoogleLinkLoading(true)
    try {
      const reauthResponse = await authApi.reauthenticate({
        currentPassword: googleLinkPassword,
        secondFactorCode: totpEnabled ? googleLinkSecondFactor.trim() || undefined : undefined,
      })
      if (reauthResponse.data?.success === false) {
        throw new Error(reauthResponse.data?.message || 'Reauthentication failed.')
      }
      const reauthData = reauthResponse.data?.data || reauthResponse.data
      const stepUpToken = reauthData?.stepUpToken
      if (!stepUpToken) throw new Error('A fresh reauthentication token was not returned. Try again.')
      const linkResponse = await authApi.linkGoogleAccount(googleLinkIdToken, stepUpToken)
      if (linkResponse.data?.success === false) {
        throw new Error(linkResponse.data?.message || 'Google could not be linked.')
      }
      setGoogleLinkIdToken('')
      setGoogleLinkPassword('')
      setGoogleLinkSecondFactor('')
      await logout()
      Alert.alert('Google linked', 'Your sessions have been revoked. Sign in again to continue.', [
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ])
    } catch (err: any) {
      setGoogleLinkError(err.response?.data?.message || err.message || 'Google could not be linked. No account changes were confirmed.')
    } finally {
      setGoogleLinkLoading(false)
    }
  }

  const handleTotpSetup = async () => {
    setTotpLoading(true); setTotpError(''); setTotpMessage('')
    try {
      if (user?.hasGoogleLogin && !totpGoogleIdToken) {
        setTotpError('Confirm your linked Google account before setting up an authenticator.')
        return
      }
      const response = await authApi.setupTwoFactor({
        currentPassword: user?.hasGoogleLogin ? undefined : totpCurrentPassword || undefined,
        googleIdToken: user?.hasGoogleLogin ? totpGoogleIdToken : undefined,
      })
      const d = response.data?.data || response.data
      setTotpSecret(d.secret || '')
      setTotpProvisioningUri(d.provisioningUri || '')
      setTotpCode('')
      setTotpGoogleIdToken('')
      setTotpMessage('Add the key to your authenticator app, then enter its current six-digit code to enable it.')
    } catch (err: any) {
      setTotpError(err.response?.data?.message || 'Authenticator setup could not start.')
    } finally { setTotpLoading(false) }
  }

  const handleTotpCancel = async () => {
    setTotpLoading(true); setTotpError(''); setTotpMessage('')
    try {
      await authApi.cancelTwoFactorSetup()
      setTotpSecret('')
      setTotpProvisioningUri('')
      setTotpCode('')
      setTotpGoogleIdToken('')
      setTotpMessage('Authenticator setup cancelled.')
    } catch (err: any) {
      setTotpError(err.response?.data?.message || 'Setup could not be cancelled on the server. The pending setup expires automatically.')
      setTotpSecret('')
      setTotpProvisioningUri('')
      setTotpCode('')
    } finally { setTotpLoading(false) }
  }

  const handleTotpConfirm = async () => {
    setTotpLoading(true); setTotpError(''); setTotpMessage('')
    try {
      const response = await authApi.confirmTwoFactor(totpCode.trim())
      const d = response.data?.data || response.data
      const recoveryCodes = Array.isArray(d.recoveryCodes) ? d.recoveryCodes : []
      setTotpEnabled(true)
      setTotpRecoveryCodes(recoveryCodes)
      setTotpRemainingCodes(recoveryCodes.length)
      setTotpSecret('')
      setTotpProvisioningUri('')
      setTotpCurrentPassword('')
      setTotpCode('')
      setTotpMessage('Authenticator enabled. Save each one-time recovery code below now; these codes cannot be retrieved later.')
    } catch (err: any) {
      setTotpError(err.response?.data?.message || 'The authenticator code could not be confirmed.')
    } finally { setTotpLoading(false) }
  }

  const handleTotpDisable = async () => {
    setTotpLoading(true); setTotpError(''); setTotpMessage('')
    try {
      await authApi.disableTwoFactor({ currentPassword: totpCurrentPassword || undefined, code: totpCode.trim() })
      setTotpEnabled(false)
      setTotpRemainingCodes(0)
      setTotpCurrentPassword('')
      setTotpCode('')
      setTotpRecoveryCodes([])
      setTotpMessage('Authenticator disabled. Signing out so you can sign in again.')
      await logout()
      navigation.navigate('Login')
    } catch (err: any) {
      setTotpError(err.response?.data?.message || 'Authenticator could not be disabled.')
    } finally { setTotpLoading(false) }
  }

  const leaveRecoveryCodes = () => {
    setTotpRecoveryCodes([])
    void logout()
    navigation.navigate('Login')
  }

  const handleUserTypeChange = async (value: string) => {
    const previous = form.userType
    setForm(f => ({ ...f, userType: value }))
    setPrefSaving(true)
    try {
      const response = await userPreferencesApi.update({
        userType: value,
        canCreateTasks: value === 'creator' || value === 'both',
        canAcceptTasks: value === 'runner' || value === 'both',
      })
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Could not update your account preference.')
      }

      // Re-read backend-calculated capabilities. A local role preference must not
      // provision creator/runner access or overwrite KYC/2FA/payout state in cache.
      const profileResponse = await authApi.getProfile()
      const profile = profileResponse.data?.data || profileResponse.data
      if (!profile) throw new Error('Could not refresh account eligibility. Try again.')
      const safeProfile = { ...profile }
      delete (safeProfile as any).idNumber
      const AsyncStorage = require('@react-native-async-storage/async-storage').default
      await AsyncStorage.setItem('currentUser', JSON.stringify(safeProfile))
      await AsyncStorage.setItem('userPreferences', JSON.stringify({
        canCreateTasks: safeProfile.canCreateTasks === true,
        canAcceptTasks: safeProfile.canAcceptTasks === true,
      }))
      setForm(f => ({ ...f, userType: safeProfile.userType || value }))
      setIdentityVerificationStatus(safeProfile.identityVerificationStatus || 'not_started')
      setAuthenticatorTwoFactorEnabled(!!safeProfile.authenticatorTwoFactorEnabled)
      setCanAcceptTasks(!!safeProfile.canAcceptTasks)
      setHasVerifiedPayoutAccount(!!safeProfile.hasVerifiedPayoutAccount)
      setMarketingConsent(!!safeProfile.marketingConsent)
      refreshUser()
      Alert.alert('Saved', 'Account preference updated. Runner eligibility remains subject to verification.')
    } catch (err: any) {
      setForm(f => ({ ...f, userType: previous }))
      Alert.alert('Could not update role', err.response?.data?.message || err.message || 'Please try again.')
    } finally {
      setPrefSaving(false)
    }
  }

  const completion = user?.profileCompletion ?? 0
  const displayName = form.firstName ? `${form.firstName} ${form.lastName}`.trim() : user?.name || 'User'

  const TABS = [
    { id: 'info' as const, label: 'Info' },
    { id: 'type' as const, label: 'Role' },
    { id: 'password' as const, label: 'Password' },
    { id: 'security' as const, label: 'Security' },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{form.email}</Text>
        <View style={[styles.typeBadge, { backgroundColor: form.userType === 'creator' ? '#DBEAFE' : form.userType === 'runner' ? '#D1FAE5' : '#EDE9FE' }]}>
          <Text style={[styles.typeBadgeText, { color: form.userType === 'creator' ? '#1D4ED8' : form.userType === 'runner' ? '#065F46' : '#5B21B6' }]}>{form.userType || 'Not set'}</Text>
        </View>
        <View style={styles.completionBar}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionLabel}>Profile Completion</Text>
              <Text style={styles.completionPct}>{completion}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completion}%` as any }]} />
            </View>
          </View>
      </View>

      <View style={styles.accountLinks}>
        <Text style={styles.accountLinksTitle}>Your account tools</Text>
        <View style={styles.accountLinksGrid}>
          {[
            { title: 'Payment history', subtitle: 'Payments and status', kind: 'payments' },
            { title: 'My disputes', subtitle: 'Track raised disputes', kind: 'disputes' },
            { title: 'Help & support', subtitle: 'Contact the support team', kind: 'support' },
            { title: 'Activity', subtitle: 'Recent task updates', kind: 'activity' },
          ].map(item => (
            <TouchableOpacity key={item.kind} style={styles.accountLink} onPress={() => navigation.navigate('AccountTools', { kind: item.kind })} accessibilityRole="button">
              <Text style={styles.accountLinkTitle}>{item.title}</Text>
              <Text style={styles.accountLinkSub}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.actionRequiredLink} onPress={() => navigation.navigate('ActionRequired')} accessibilityRole="button"><Text style={styles.actionRequiredTitle}>Action required</Text><Text style={styles.accountLinkSub}>Payments and completion reviews waiting for you</Text></TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && styles.tabActive]} onPress={() => setActiveTab(t.id)}>
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Personal Info */}
      {activeTab === 'info' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>First Name</Text>
              <TextInput style={styles.input} value={form.firstName} onChangeText={set('firstName')} placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput style={styles.input} value={form.lastName} onChangeText={set('lastName')} placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={form.email} editable={false} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.hint}>Email changes require a separate verification flow and are not available here.</Text>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={form.phoneNumber} onChangeText={set('phoneNumber')} keyboardType="phone-pad" placeholderTextColor={COLORS.textMuted} />
          {(form.userType === 'runner' || form.userType === 'both') && (
            <View style={styles.eligibilityCard}>
              <Text style={styles.eligibilityTitle}>Runner identity onboarding</Text>
              <Text style={styles.hint}>{hasIdNumber ? `An ID number is already on file ending ${idNumberLastFour}.` : 'Identity information will be collected through the dedicated verification flow once the provider and data protection controls are configured.'}</Text>
              <Text style={styles.hint}>Do not send identity documents through this general profile form. A valid ID format is not identity verification.</Text>
            </View>
          )}
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={form.address} onChangeText={set('address')} placeholderTextColor={COLORS.textMuted} />
          <Button title="Save Changes" onPress={handleSave} loading={loading} fullWidth style={{ marginTop: 8 }} />
        </View>
      )}

      {/* Optional marketing consent */}
      {activeTab === 'info' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Marketing preferences</Text>
          <View style={styles.marketingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketingTitle}>Optional product updates and offers</Text>
              <Text style={styles.hint}>This is optional and can be changed at any time. Important account, task, security and payment messages are not marketing.</Text>
              {marketingConsentSaving && <Text style={styles.hint} accessibilityRole="text">Saving preference…</Text>}
            </View>
            <Switch
              value={marketingConsent}
              onValueChange={handleMarketingConsentChange}
              disabled={marketingConsentSaving}
              accessibilityLabel="Receive optional DoForYou marketing emails"
            />
          </View>
        </View>
      )}

      {/* User Type */}
      {activeTab === 'type' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Type & Role</Text>
          <Text style={styles.hint}>Choose how you want to use DoForYou:</Text>
          {USER_TYPES.map(t => (
            <TouchableOpacity key={t.value} style={[styles.typeCard, form.userType === t.value && styles.typeCardActive]} onPress={() => handleUserTypeChange(t.value)} disabled={prefSaving}>
              <Text style={styles.typeLabel}>{t.label}</Text>
              <Text style={styles.typeDesc}>{t.desc}</Text>
              {form.userType === t.value && <Text style={styles.typeCheck}>✓ Selected</Text>}
            </TouchableOpacity>
          ))}
          {(form.userType === 'runner' || form.userType === 'both') && (
            <View style={styles.eligibilityCard} accessibilityRole="summary">
              <Text style={styles.eligibilityTitle}>Runner eligibility</Text>
              <Text style={styles.hint}>Identity check: {identityVerificationStatus.replace(/_/g, ' ')}.</Text>
              <Text style={styles.hint}>Authenticator 2FA: {authenticatorTwoFactorEnabled ? 'enabled' : 'not enabled'}.</Text>
              <Text style={styles.hint}>Payout account: {hasVerifiedPayoutAccount ? 'bank recipient verified' : 'not verified'}.</Text>
              <Text style={styles.hint}>{canAcceptTasks ? 'Runner task acceptance is enabled.' : 'Task acceptance stays locked until the backend confirms passed identity verification and enabled authenticator 2FA.'}</Text>
              {identityVerificationStatus !== 'passed' && identityVerificationStatus !== 'manual_review' && (
                <View style={{ marginTop: SPACING.sm, gap: 8 }}>
                  {!identityProviderConfigured ? (
                    <Text style={styles.hint}>Identity verification is not enabled on this staging API yet. Provider credentials, webhook secret, verification level, and an approved notice version must be configured first.</Text>
                  ) : (
                    <>
                      <Text style={styles.hint}>Sumsub will collect identity-document and liveness evidence. DoForYou stores only the provider status and minimal event metadata.</Text>
                      <TouchableOpacity
                        onPress={() => { void Linking.openURL(IDENTITY_PRIVACY_URL).catch(() => Alert.alert('Privacy notice', IDENTITY_PRIVACY_URL)) }}
                        accessibilityRole="link"
                        disabled={identitySessionLoading}
                      >
                        <Text style={styles.linkText}>Read the Privacy Policy</Text>
                      </TouchableOpacity>
                      <View style={styles.consentRow}>
                        <Switch
                          value={identityConsentAccepted}
                          onValueChange={setIdentityConsentAccepted}
                          disabled={identitySessionLoading}
                          accessibilityLabel="Consent to runner identity and liveness verification"
                        />
                        <Text style={[styles.hint, { flex: 1 }]}>
                          I consent to runner identity and liveness verification as described in the privacy notice.
                        </Text>
                      </View>
                      <Text style={styles.hint}>Verification starts remaining in this 24-hour window: {identityAttemptsRemaining}.</Text>
                      {!!identitySessionError && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{identitySessionError}</Text></View>}
                      <Button
                        title={identitySessionLoading ? 'Preparing verification…' : 'Start identity verification'}
                        onPress={() => {
                          Alert.alert(
                            'Before you continue',
                            'The verification provider will collect identity-document and liveness evidence. DoForYou receives the review result. Continue only after reading the Privacy Policy.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Continue', onPress: () => { void startIdentityVerification() } },
                            ],
                          )
                        }}
                        loading={identitySessionLoading}
                        disabled={identitySessionLoading || !identityConsentAccepted || identityAttemptsRemaining < 1}
                        fullWidth
                        style={{ marginTop: 4 }}
                      />
                    </>
                  )}
                </View>
              )}
              {identityVerificationStatus === 'manual_review' && (
                <Text style={styles.hint}>Your verification requires review. Task acceptance remains locked; contact support for next steps.</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Authenticator security */}
      {activeTab === 'security' && (
        <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Linked sign-in methods</Text>
          {user?.hasGoogleLogin ? (
            <Text style={styles.hint}>Google sign-in is linked to this account.</Text>
          ) : hasPasswordLogin ? (
            <>
              <Text style={styles.hint}>Link Google only after selecting the account and proving control of this DoForYou account. Matching email alone never merges accounts.</Text>
              {!!googleLinkError && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{googleLinkError}</Text></View>}
              {!!googleLinkMessage && <View style={styles.eligibilityCard} accessibilityRole="summary"><Text style={styles.hint}>{googleLinkMessage}</Text></View>}
              <GoogleSignInButton
                onIdToken={(token) => {
                  setGoogleLinkIdToken(token)
                  setGoogleLinkError('')
                  setGoogleLinkMessage('Google account selected. Complete reauthentication to link it.')
                }}
                disabled={googleLinkLoading}
              />
              {!!googleLinkIdToken && (
                <>
                  <Text style={styles.label}>Current DoForYou password</Text>
                  <TextInput style={styles.input} value={googleLinkPassword} onChangeText={setGoogleLinkPassword} secureTextEntry autoComplete="current-password" placeholder="Confirm your current password" placeholderTextColor={COLORS.textMuted} />
                  {totpEnabled && (
                    <>
                      <Text style={styles.label}>Authenticator or recovery code</Text>
                      <TextInput style={styles.input} value={googleLinkSecondFactor} onChangeText={setGoogleLinkSecondFactor} autoCapitalize="characters" autoComplete="one-time-code" maxLength={20} placeholder="Code or recovery code" placeholderTextColor={COLORS.textMuted} />
                    </>
                  )}
                  <Button title={googleLinkLoading ? 'Reauthenticating…' : 'Link Google account'} onPress={() => { void handleGoogleLink() }} loading={googleLinkLoading} disabled={googleLinkLoading || !googleLinkPassword || (totpEnabled && !googleLinkSecondFactor.trim())} fullWidth style={{ marginTop: 8 }} />
                  <Button title="Cancel" onPress={() => { setGoogleLinkIdToken(''); setGoogleLinkPassword(''); setGoogleLinkSecondFactor(''); setGoogleLinkError(''); setGoogleLinkMessage('') }} disabled={googleLinkLoading} variant="secondary" fullWidth style={{ marginTop: 8 }} />
                </>
              )}
            </>
          ) : (
            <Text style={styles.hint}>Google linking is unavailable for this account's current sign-in configuration. Contact support if you need to change your sign-in method.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authenticator security</Text>
          {!!totpError && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{totpError}</Text></View>}
          {!!totpMessage && <View style={styles.eligibilityCard} accessibilityRole="summary"><Text style={styles.hint}>{totpMessage}</Text></View>}
          <Text style={styles.hint}>
            An authenticator app generates your sign-in codes. Recovery codes work once each. Turning this feature on or off signs out existing sessions.
          </Text>
          {!totpConfigured && <Text style={styles.hint}>Authenticator enrollment is disabled on this staging API until its encryption key is configured.</Text>}
          {totpRecoveryCodes.length > 0 && (
            <View style={styles.recoveryCard}>
              <Text style={styles.eligibilityTitle}>Save these recovery codes now</Text>
              <Text style={styles.hint}>They will not be shown again. Save them in a secure password manager or other protected place.</Text>
              <View style={styles.recoveryCodeGrid}>
                {totpRecoveryCodes.map(code => <Text key={code} selectable style={styles.recoveryCode}>{code}</Text>)}
              </View>
              <Button title="I've saved my codes — sign out" onPress={leaveRecoveryCodes} fullWidth style={{ marginTop: 8 }} />
            </View>
          )}
          {totpConfigured && !totpEnabled && !totpSecret && (
            <>
              {user?.hasGoogleLogin ? (
                <>
                  <Text style={styles.hint}>Confirm control of your linked Google account for this authenticator setup.</Text>
                  <GoogleSignInButton
                    onIdToken={token => { setTotpGoogleIdToken(token); setTotpError(''); setTotpMessage('Google account confirmed. Continue to set up authenticator.') }}
                    disabled={totpLoading}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>Current password</Text>
                  <TextInput style={styles.input} value={totpCurrentPassword} onChangeText={setTotpCurrentPassword} secureTextEntry autoComplete="current-password" placeholder="Confirm your current password" placeholderTextColor={COLORS.textMuted} />
                </>
              )}
              <Button title="Set up authenticator" onPress={handleTotpSetup} loading={totpLoading} disabled={totpLoading || (user?.hasGoogleLogin ? !totpGoogleIdToken : !totpCurrentPassword)} fullWidth style={{ marginTop: 8 }} />
            </>
          )}
          {totpConfigured && !totpEnabled && !!totpSecret && (
            <>
              <Text style={styles.label}>Authenticator setup key</Text>
              <Text selectable style={styles.recoveryCode}>{totpSecret}</Text>
              <Text style={styles.hint}>In your authenticator app, choose “enter setup key” and type this key. Do not share it.</Text>
              <Text style={styles.label}>Current six-digit code</Text>
              <TextInput style={styles.input} value={totpCode} onChangeText={v => setTotpCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="123456" placeholderTextColor={COLORS.textMuted} />
              <Button title="Confirm and enable" onPress={handleTotpConfirm} loading={totpLoading} disabled={totpLoading || totpCode.length !== 6} fullWidth style={{ marginTop: 8 }} />
              <Button title="Cancel setup" onPress={handleTotpCancel} loading={totpLoading} disabled={totpLoading} variant="secondary" fullWidth style={{ marginTop: 8 }} />
              <Text selectable style={[styles.hint, { marginTop: 8 }]}>Advanced provisioning URI: {totpProvisioningUri}</Text>
            </>
          )}
          {totpConfigured && totpEnabled && totpRecoveryCodes.length === 0 && (
            <>
              <Text style={styles.hint}>Authenticator enabled. Remaining recovery codes: {totpRemainingCodes}.</Text>
              {!user?.hasGoogleLogin && (
                <>
                  <Text style={styles.label}>Current password</Text>
                  <TextInput style={styles.input} value={totpCurrentPassword} onChangeText={setTotpCurrentPassword} secureTextEntry autoComplete="current-password" placeholder="Confirm your current password" placeholderTextColor={COLORS.textMuted} />
                </>
              )}
              <Text style={styles.label}>Authenticator or recovery code</Text>
              <TextInput style={styles.input} value={totpCode} onChangeText={setTotpCode} autoCapitalize="characters" autoComplete="one-time-code" maxLength={20} placeholder="Six-digit code or recovery code" placeholderTextColor={COLORS.textMuted} />
              <Button title="Disable authenticator" onPress={handleTotpDisable} loading={totpLoading} disabled={totpLoading || !totpCode.trim()} fullWidth style={{ marginTop: 8 }} />
            </>
          )}
        </View>
        </>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <View style={styles.card}>
          {hasPasswordLogin ? (
            <>
              <Text style={styles.cardTitle}>Change Password</Text>
              <Text style={styles.label}>Current Password</Text>
              <TextInput style={styles.input} value={pwForm.currentPassword} onChangeText={v => setPwForm(f => ({ ...f, currentPassword: v }))} secureTextEntry autoComplete="current-password" placeholderTextColor={COLORS.textMuted} placeholder="Current password" />
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} value={pwForm.newPassword} onChangeText={v => setPwForm(f => ({ ...f, newPassword: v }))} secureTextEntry autoComplete="new-password" placeholderTextColor={COLORS.textMuted} placeholder="12–72 characters" />
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput style={styles.input} value={pwForm.confirmPassword} onChangeText={v => setPwForm(f => ({ ...f, confirmPassword: v }))} secureTextEntry autoComplete="new-password" placeholderTextColor={COLORS.textMuted} placeholder="Repeat new password" />
              <Button title="Change Password" onPress={handlePwChange} loading={pwLoading} fullWidth style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Add password sign-in</Text>
              <Text style={styles.hint}>This account uses Google sign-in and does not have an email/password sign-in method yet. Request a password setup link sent to your verified email address.</Text>
              {!!passwordSetupMessage && <View style={styles.eligibilityCard} accessibilityRole="summary"><Text style={styles.hint}>{passwordSetupMessage}</Text></View>}
              {!!passwordSetupError && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{passwordSetupError}</Text></View>}
              <Button title={passwordSetupLoading ? 'Sending…' : 'Email password setup link'} onPress={requestPasswordSetup} loading={passwordSetupLoading} disabled={passwordSetupLoading || !form.email} fullWidth style={{ marginTop: 8 }} />
            </>
          )}
        </View>
      )}

      <Button title="Bank Accounts" onPress={() => navigation.navigate('BankAccounts')} variant="secondary" fullWidth style={{ marginTop: 8 }} />
      <SignOutButton onConfirm={logout} style={{ marginTop: 8 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40, gap: 16 },
  accountLinks: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  accountLinksTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  accountLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionRequiredLink: { marginTop: 9, padding: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.border },
  actionRequiredTitle: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '900' },
  accountLink: { width: '48%', padding: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderLight },
  accountLinkTitle: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },
  accountLinkSub: { color: COLORS.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  profileCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', ...SHADOW.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: '800', color: COLORS.white },
  displayName: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  email: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  completionBar: { width: '100%', marginTop: 12 },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  completionLabel: { fontSize: 12, color: COLORS.textSecondary },
  completionPct: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  eligibilityCard: { marginTop: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  eligibilityTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  linkText: { color: COLORS.primary, textDecorationLine: 'underline', fontSize: 13, fontWeight: '700' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  marketingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  marketingTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 5 },
  errorBox: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: SPACING.sm },
  errorText: { fontSize: 13, color: '#991B1B' },
  recoveryCard: { padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, marginVertical: SPACING.sm },
  recoveryCodeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  recoveryCode: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', padding: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.surface, overflow: 'hidden' },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 4, ...SHADOW.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.sm, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  typeCard: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, marginBottom: 8 },
  typeCardActive: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  typeLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  typeDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  typeCheck: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 6 },
})
