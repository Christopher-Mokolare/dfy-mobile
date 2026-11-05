import React, { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import AuthBrandHeader from '../../components/AuthBrandHeader'
import AuthScreenLayout from '../../components/AuthScreenLayout'
import FormField from '../../components/FormField'
import StepIndicator from '../../components/StepIndicator'
import { colors, fonts, radii } from '../../theme'

const STEPS = ['Your details', 'Your role', 'Security']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LEGAL_BASE_URL = process.env.EXPO_PUBLIC_DFY_WEB_URL || 'https://dfy-fe-staging.onrender.com'
const TERMS_URL = `${LEGAL_BASE_URL}/terms`
const PRIVACY_URL = `${LEGAL_BASE_URL}/privacy`
const TERMS_VERSION = 'terms-v1'
const PRIVACY_VERSION = 'privacy-v1'

function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
  }
  return bytes
}
/**
 * Accepts "081 234 5678", "81 234 5678" or "+27 81 234 5678" and returns the local
 * format the app has always sent to the API ("0812345678"), or null if invalid.
 * If your backend expects "+27812345678", change the return to `+27${d}`.
 */
function toLocalSouthAfricanNumber(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('27')) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  return /^[6-8]\d{8}$/.test(d) ? `0${d}` : null
}

function readGoogleClaims(idToken: string | null): { email?: string; given_name?: string; family_name?: string } {
  if (!idToken) return {}
  try {
    const part = idToken.split('.')[1]
    if (!part) return {}
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
    const json = decodeURIComponent(Array.from(decoded, character =>
      `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`
    ).join(''))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

const ROLES = [
  { value: 'creator', icon: 'clipboard-outline', label: 'Task Creator', desc: 'Post tasks for others' },
  { value: 'runner', icon: 'walk-outline', label: 'Task Runner', desc: 'Complete tasks & earn' },
  { value: 'both', icon: 'people-outline', label: 'Both', desc: 'Post & complete tasks' },
] as const

export default function RegisterScreen({ navigation, route }: any) {
  const initialGoogleToken = route?.params?.googleIdToken || null
  const initialGoogleClaims = readGoogleClaims(initialGoogleToken)
  const { googleRegister } = useAuth()
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(initialGoogleToken)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [form, setForm] = useState({
    firstName: initialGoogleClaims.given_name || '', lastName: initialGoogleClaims.family_name || '',
    email: initialGoogleClaims.email || '', phoneNumber: '',
    userType: '',
    password: '', confirmPassword: '',
  })

  const lastRef = useRef<TextInput>(null)
  const emailRef = useRef<TextInput>(null)
  const phoneRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  const set = (field: string) => (val: string) => setForm((f: typeof form) => ({ ...f, [field]: val }))

  const finishValidation = (next: Record<string, string>) => {
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) e.lastName = 'Enter your last name.'
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!toLocalSouthAfricanNumber(form.phoneNumber)) e.phoneNumber = 'Enter a valid South African mobile number.'
    return finishValidation(e)
  }

  const validateStep2 = () => {
    const e: Record<string, string> = {}
    if (!form.userType) e.userType = 'Choose how you want to use DoForYou.'
    return finishValidation(e)
  }

  const validateStep3 = () => {
    const e: Record<string, string> = {}
    if (!googleIdToken) {
      if (form.password.length < 12 || form.password.length > 72 || utf8ByteLength(form.password) > 72) e.password = 'Use a password between 12 and 72 characters and no more than 72 UTF-8 bytes.'
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    }
    return finishValidation(e)
  }

  const goBack = () => {
    setError('')
    setErrors({})
    if (step === 1) navigation.navigate('Login')
    else setStep(step - 1)
  }

  const handleGoogleIdToken = (idToken: string) => {
    const claims = readGoogleClaims(idToken)
    setGoogleIdToken(idToken)
    setForm(current => ({
      ...current,
      firstName: current.firstName || claims.given_name || '',
      lastName: current.lastName || claims.family_name || '',
      email: claims.email || current.email,
      password: '',
      confirmPassword: '',
    }))
    setError('')
  }

  const handleSubmit = async () => {
    if (loading) return
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Please accept the Terms & Conditions and acknowledge the Privacy Policy to continue.')
      return
    }
    if (!validateStep3()) return
    setError('')
    setLoading(true)
    try {
      if (googleIdToken) {
        await googleRegister({
          idToken: googleIdToken,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phoneNumber: toLocalSouthAfricanNumber(form.phoneNumber) ?? form.phoneNumber,
          userType: form.userType,
          termsAccepted: acceptedTerms,
          privacyAccepted: acceptedPrivacy,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          marketingConsent,
        })
        // The authenticated navigator mounts the signed-in routes.
        return
      }

      const res = await authApi.register({
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(), phoneNumber: toLocalSouthAfricanNumber(form.phoneNumber) ?? form.phoneNumber,
        userType: form.userType,
        password: form.password,
        termsAccepted: acceptedTerms, privacyAccepted: acceptedPrivacy,
        termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
        marketingConsent,
      })
      if (res.data.success) {
        const needsEmailVerification = res.data.requiresEmailVerification
          ?? res.data.emailVerificationRequired
          ?? res.data.user?.emailVerified === false
        const title = needsEmailVerification ? 'Verify your email' : 'Account request received'
        const message = res.data.message
          || (needsEmailVerification
            ? 'Follow the verification instructions sent to your email before signing in.'
            : 'Your account request was received. Sign in only after completing any verification requested by DoForYou.')
        Alert.alert(title, message, [
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ])
      } else {
        setError(res.data.message || 'Registration failed')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrimary = () => {
    if (step === 1) { if (validateStep1()) setStep(2) }
    else if (step === 2) { if (validateStep2()) setStep(3) }
    else handleSubmit()
  }

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', `Please open ${url} in your browser.`)
    })
  }

  const footer = (
    <View>
      {step === 3 && (
        <View>
          <View style={styles.consentRow}>
            <Pressable
              onPress={() => setAcceptedTerms(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              accessibilityLabel="Accept the Terms and Conditions"
              style={styles.consentCheckboxTouch}
            >
              <View style={[styles.consentBox, acceptedTerms && styles.consentBoxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={15} color={colors.text} />}
              </View>
            </Pressable>
            <Text style={styles.terms}>
              I accept the DoForYou{' '}
              <Text style={styles.link} onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
                Terms & Conditions
              </Text>.
            </Text>
          </View>
          <View style={styles.consentRow}>
            <Pressable
              onPress={() => setAcceptedPrivacy(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedPrivacy }}
              accessibilityLabel="Acknowledge the Privacy Policy"
              style={styles.consentCheckboxTouch}
            >
              <View style={[styles.consentBox, acceptedPrivacy && styles.consentBoxChecked]}>
                {acceptedPrivacy && <Ionicons name="checkmark" size={15} color={colors.text} />}
              </View>
            </Pressable>
            <Text style={styles.terms}>
              I acknowledge the DoForYou{' '}
              <Text style={styles.link} onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
                Privacy Policy
              </Text>.
            </Text>
          </View>
          <View style={styles.consentRow}>
            <Pressable
              onPress={() => setMarketingConsent(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marketingConsent }}
              accessibilityLabel="Receive optional marketing updates"
              style={styles.consentCheckboxTouch}
            >
              <View style={[styles.consentBox, marketingConsent && styles.consentBoxChecked]}>
                {marketingConsent && <Ionicons name="checkmark" size={15} color={colors.text} />}
              </View>
            </Pressable>
            <Text style={styles.terms}>Send me optional DoForYou product updates and offers.</Text>
          </View>
        </View>
      )}

      <Pressable
        style={({ pressed }: { pressed: boolean }) => [styles.button, pressed && !loading && styles.pressed, loading && styles.loading]}
        onPress={handlePrimary}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={step === 3 ? 'Create account' : 'Continue'}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>{step === 3 ? (googleIdToken ? 'Create Account with Google' : 'Create Account') : 'Continue'}</Text>
            <Ionicons name={step === 3 ? 'checkmark' : 'arrow-forward'} size={18} color={colors.text} />
          </View>
        )}
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} accessibilityRole="link" style={styles.switchLink}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  )

  return (
    <AuthScreenLayout footer={footer}>
      <AuthBrandHeader />

      <View style={styles.headingRow}>
        <Pressable
          onPress={goBack}
          style={styles.back}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'Back to sign in' : 'Back to previous step'}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>Join your community.</Text>
      </View>

      <Text style={styles.subtitle}>Create one account to post tasks, find work, and get things moving.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Account</Text>
        <StepIndicator steps={STEPS} current={step - 1} />

        {!!error && (
          <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <View style={styles.nameRow}>
              <FormField
                label="First name *"
                value={form.firstName}
                onChangeText={set('firstName')}
                error={errors.firstName}
                placeholder="John"
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={() => lastRef.current?.focus()}
                containerStyle={styles.half}
              />
              <FormField
                ref={lastRef}
                label="Last name *"
                value={form.lastName}
                onChangeText={set('lastName')}
                error={errors.lastName}
                placeholder="Doe"
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                containerStyle={styles.half}
              />
            </View>
            <FormField
              ref={emailRef}
              label="Email address *"
              value={form.email}
              editable={!googleIdToken}
              onChangeText={set('email')}
              error={errors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <FormField
              ref={phoneRef}
              label="Phone number (South Africa) *"
              prefix="+27"
              value={form.phoneNumber}
              onChangeText={set('phoneNumber')}
              error={errors.phoneNumber}
              placeholder="81 234 5678"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={14}
              returnKeyType="done"
              onSubmitEditing={handlePrimary}
              containerStyle={{ marginBottom: 0 }}
            />
            {!googleIdToken && (
              <View style={{ marginTop: 18, gap: 12 }}>
                <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>or</Text><View style={styles.orLine} /></View>
                <GoogleSignInButton onIdToken={handleGoogleIdToken} disabled={loading} />
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.groupLabel}>I want to...</Text>
            {ROLES.map((r) => {
              const selected = form.userType === r.value
              return (
                <Pressable
                  key={r.value}
                  style={[styles.roleCard, selected && styles.roleCardSelected]}
                  onPress={() => setForm((f: typeof form) => ({ ...f, userType: r.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${r.label}. ${r.desc}`}
                >
                  <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                    <Ionicons name={r.icon} size={22} color={selected ? colors.button : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.orange} />}
                </Pressable>
              )
            })}
            {!!errors.userType && <Text style={styles.fieldError}>{errors.userType}</Text>}

            <Text style={styles.hint}>
              You can complete runner identity verification later, before accepting paid tasks. Your phone number is for contact only; DoForYou does not verify it by SMS.
            </Text>
          </View>
        )}

        {step === 3 && (
          <View>
            {!googleIdToken ? (
              <>
                <FormField
                  label="Password *"
                  value={form.password}
                  onChangeText={set('password')}
                  error={errors.password}
                  placeholder="12–72 characters"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  right={
                    <Pressable onPress={() => setShowPassword((v: boolean) => !v)} style={styles.eye} hitSlop={4} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
                    </Pressable>
                  }
                />
                <FormField
                  ref={confirmRef}
                  label="Confirm password *"
                  value={form.confirmPassword}
                  onChangeText={set('confirmPassword')}
                  error={errors.confirmPassword}
                  placeholder="Repeat password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  containerStyle={{ marginBottom: 0 }}
                />
              </>
            ) : (
              <View style={styles.googleSignupNote}>
                <Text style={styles.googleSignupTitle}>Continue with Google</Text>
                <Text style={styles.hint}>This account will use your Google sign-in. DoForYou will not create a separate password for this account.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute', left: 0, top: 0, zIndex: 1, width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headingRow: { position: 'relative', minHeight: 44, justifyContent: 'center', marginTop: 20 },
  heading: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, color: colors.text, textAlign: 'center', paddingHorizontal: 44 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: radii.card, padding: 18, marginTop: 20,
  },
  cardTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.text, textAlign: 'center' },
  errorBox: { padding: 12, borderRadius: 10, backgroundColor: colors.errorBg, marginBottom: 14 },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: colors.error },
  nameRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, minWidth: 0 },
  groupLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginBottom: 8 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5,
    borderColor: colors.inputBorder, backgroundColor: colors.surface,
    borderRadius: radii.input + 2, padding: 12, marginBottom: 10, minHeight: 64,
  },
  roleCardSelected: { borderColor: colors.orange, backgroundColor: '#FFF1E5' },
  roleIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1E5',
    alignItems: 'center', justifyContent: 'center',
  },
  roleIconSelected: { backgroundColor: colors.iconCircle },
  roleLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  roleLabelSelected: { color: colors.button },
  roleDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  fieldError: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginTop: -4 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 14 },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  consentCheckboxTouch: { width: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  consentBox: {
    width: 20, height: 20, borderWidth: 1.5, borderColor: colors.inputBorder,
    borderRadius: 5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  consentBoxChecked: { backgroundColor: colors.button, borderColor: colors.button },
  terms: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.button },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 3 },
  orLine: { height: 1, flex: 1, backgroundColor: colors.cardBorder },
  orText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 },
  googleSignupNote: { padding: 14, borderRadius: radii.input, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, gap: 6 },
  googleSignupTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  button: {
    height: 52, borderRadius: radii.button, backgroundColor: colors.button,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.88 },
  loading: { opacity: 0.8 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  switchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  switchLink: { minHeight: 44, justifyContent: 'center' },
})
