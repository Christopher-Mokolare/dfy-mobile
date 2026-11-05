import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { colors, fonts, radii } from '../../theme'

WebBrowser.maybeCompleteAuthSession()

interface Props {
  onIdToken: (token: string) => void
  disabled?: boolean
}

function GoogleSignInButtonConfigured({ onIdToken, disabled = false }: Props) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  }, { scheme: 'doforyou' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const processedToken = useRef<string | null>(null)

  useEffect(() => {
    if (!response) return
    if (response.type === 'error') {
      setError('Google sign-in could not be completed. Try again.')
      setLoading(false)
      return
    }
    if (response.type === 'success') {
      const token = response.params?.id_token || response.authentication?.idToken
      if (!token) {
        setError('Google did not return a verified sign-in token. Try again.')
        setLoading(false)
        return
      }
      if (processedToken.current === token) return
      processedToken.current = token
      setError('')
      setLoading(false)
      onIdToken(token)
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setLoading(false)
    }
  }, [response, onIdToken])

  const signIn = async () => {
    if (disabled || loading || !request) return
    setError('')
    setLoading(true)
    try {
      await promptAsync()
    } catch {
      setLoading(false)
      setError('Google sign-in could not be opened. Check your connection and try again.')
    }
  }

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && !disabled && !loading && styles.pressed, (disabled || loading || !request) && styles.disabled]}
        onPress={signIn}
        disabled={disabled || loading || !request}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {loading ? <ActivityIndicator color={colors.text} /> : (
          <View style={styles.buttonInner}>
            <View style={styles.googleMark}><Text style={styles.googleG}>G</Text></View>
            <Text style={styles.buttonText}>Continue with Google</Text>
          </View>
        )}
      </Pressable>
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    </View>
  )
}

export default function GoogleSignInButton(props: Props) {
  const platformClientId = Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  })
  if (!platformClientId?.trim()) {
    return <Text style={styles.unavailable} accessibilityRole="text">Google sign-in is not configured for this build.</Text>
  }
  return <GoogleSignInButtonConfigured {...props} />
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleMark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  googleG: { color: '#4285F4', fontSize: 16, fontWeight: '800' },
  buttonText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  error: { color: colors.error, fontFamily: fonts.regular, fontSize: 12, marginTop: 8 },
  unavailable: { color: colors.textSecondary, fontFamily: fonts.regular, textAlign: 'center', fontSize: 12, lineHeight: 18 },
})
