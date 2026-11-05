import React, { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import AuthBrandHeader from '../../components/AuthBrandHeader'
import AuthScreenLayout from '../../components/AuthScreenLayout'
import FormField from '../../components/FormField'
import { colors, fonts, radii } from '../../theme'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginScreen({ navigation }: any) {
  const { login, googleLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [secondFactorCode, setSecondFactorCode] = useState('')
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null)
  const passwordRef = useRef<TextInput>(null)

  const requestPasswordReset = async () => {
    const accountEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(accountEmail)) {
      Alert.alert('Enter your email', 'Enter the email address for your DoForYou account first.')
      return
    }
    try {
      const response = await authApi.forgotPassword(accountEmail)
      Alert.alert('Check your email', response.data?.message || 'If an account matches that email, reset instructions will be sent shortly.')
    } catch {
      Alert.alert('Check your email', 'If an account matches that email, reset instructions will be sent shortly.')
    }
  }

  const resendVerification = async () => {
    const accountEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(accountEmail)) {
      Alert.alert('Enter your email', 'Enter the email address for your account first.')
      return
    }
    setResending(true)
    try {
      const response = await authApi.resendVerification(accountEmail)
      Alert.alert('Check your inbox', response.data?.message || 'If the account needs verification, an email will be sent shortly.')
      setFormError('')
    } catch {
      Alert.alert('Check your inbox', 'If the account needs verification, an email will be sent shortly.')
      setFormError('')
    } finally {
      setResending(false)
    }
  }

  const handleSignIn = async () => {
    if (loading) return
    const trimmedEmail = email.trim()

    if (requiresTwoFactor && !secondFactorCode.trim()) {
      setFormError('Enter the authenticator or recovery code to continue.')
      return
    }

    if (!pendingGoogleToken) {
      const nextEmailError = EMAIL_RE.test(trimmedEmail) ? '' : 'Enter a valid email address.'
      const nextPasswordError = password ? '' : 'Enter your password.'
      setEmailError(nextEmailError)
      setPasswordError(nextPasswordError)
      if (nextEmailError || nextPasswordError) return
    }

    setFormError('')
    setLoading(true)
    try {
      if (pendingGoogleToken) {
        await googleLogin(pendingGoogleToken, requiresTwoFactor ? secondFactorCode.trim() : undefined)
      } else {
        await login(trimmedEmail.toLowerCase(), password, requiresTwoFactor ? secondFactorCode.trim() : undefined)
      }
      setPendingGoogleToken(null)
      setRequiresTwoFactor(false)
      setSecondFactorCode('')
    } catch (err: any) {
      if (err.response?.data?.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        setFormError(err.response?.data?.message || 'Enter your authenticator or recovery code to continue.')
      } else if (err.response?.data?.requiresAccountSetup && pendingGoogleToken) {
        navigation.navigate('Register', { googleIdToken: pendingGoogleToken })
      } else {
        setFormError(err.response?.data?.message || err.message || 'We could not sign you in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleIdToken = async (idToken: string) => {
    setLoading(true)
    setFormError('')
    try {
      await googleLogin(idToken)
    } catch (err: any) {
      if (err.response?.data?.requiresTwoFactor) {
        setPendingGoogleToken(idToken)
        setRequiresTwoFactor(true)
        setFormError(err.response?.data?.message || 'Enter your authenticator or recovery code to continue.')
      } else if (err.response?.data?.requiresAccountSetup) {
        navigation.navigate('Register', { googleIdToken: idToken })
      } else {
        setFormError(err.response?.data?.message || err.message || 'Google sign-in could not be completed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <View>
      <Pressable
        style={({ pressed }: { pressed: boolean }) => [styles.button, pressed && !loading && styles.pressed, loading && styles.loading]}
        onPress={handleSignIn}
        disabled={loading || (requiresTwoFactor && !secondFactorCode.trim())}
        accessibilityRole="button"
        accessibilityLabel={requiresTwoFactor ? 'Verify and sign in' : 'Sign in to DFY'}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>{requiresTwoFactor ? 'Verify & sign in' : 'Sign in to DFY'}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.text} />
          </View>
        )}
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>New to DoForYou?</Text>
        <Pressable
          onPress={() => navigation.navigate('Register')}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.switchLink}
        >
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>

      <View style={styles.secureRow}>
        <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.secureText}>Your tasks and payments are managed securely.</Text>
      </View>
    </View>
  )

  return (
    <AuthScreenLayout footer={footer}>
      <AuthBrandHeader />

      <Text style={styles.heading}>Help your community thrive.</Text>
      <Text style={styles.subtitle}>
        Find a helping hand, offer your skills, and get everyday things moving.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSubtitle}>Sign in to pick up where you left off.</Text>

        {!!formError && (
          <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}
        {formError.toLowerCase().includes('verify your email') && (
          <Pressable onPress={resendVerification} disabled={resending} style={styles.forgot} accessibilityRole="button">
            <Text style={styles.link}>{resending ? 'Sending verification email…' : 'Resend verification email'}</Text>
          </Pressable>
        )}

        <FormField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <FormField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
          containerStyle={{ marginBottom: 4 }}
          right={
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eye}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={21}
                color={colors.textSecondary}
              />
            </Pressable>
          }
        />

        {requiresTwoFactor && (
          <FormField
            label="Authenticator or recovery code"
            value={secondFactorCode}
            onChangeText={setSecondFactorCode}
            placeholder="Six-digit code or recovery code"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={20}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
            containerStyle={{ marginTop: 8 }}
          />
        )}

        <View style={{ gap: 12, marginTop: 18 }}>
          <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>or</Text><View style={styles.orLine} /></View>
          <GoogleSignInButton onIdToken={handleGoogleIdToken} disabled={loading} />
        </View>

        <Pressable
          onPress={requestPasswordReset}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.forgot}
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.medium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: 18,
    marginTop: 20,
  },
  cardTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.text, textAlign: 'center' },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.button },
  errorBox: { padding: 12, borderRadius: 10, backgroundColor: colors.errorBg, marginBottom: 14 },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: colors.error },
  button: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.88 },
  loading: { opacity: 0.8 },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  switchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  switchLink: { minHeight: 44, justifyContent: 'center' },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  secureText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { height: 1, flex: 1, backgroundColor: colors.cardBorder },
  orText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 },
})
