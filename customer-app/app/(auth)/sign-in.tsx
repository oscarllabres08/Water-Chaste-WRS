import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { parseAuthCredentials, sanitizeAuthEmail, sanitizeAuthPassword } from '../../lib/authInputSecurity';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../ui/components/Screen';
import { Card } from '../../ui/components/Card';
import { Text } from '../../ui/components/Text';
import { TextField } from '../../ui/components/TextField';
import { Button } from '../../ui/components/Button';
import { LegalAcceptanceRow } from '../../ui/components/LegalAcceptanceRow';
import { theme } from '../../ui/theme';

const authLogo = require('../../assets/logo.png');

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const layoutHeight = useRef(0);
  const contentHeight = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  function updateScroll(layout: number, content: number) {
    if (layout > 0) layoutHeight.current = layout;
    if (content > 0) contentHeight.current = content;
    if (layoutHeight.current <= 0 || contentHeight.current <= 0) return;
    const next = contentHeight.current > layoutHeight.current + 8;
    setCanScroll((prev) => (prev === next ? prev : next));
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      if (contentHeight.current <= layoutHeight.current + 8) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function submit() {
    setError(null);
    if (!accepted) {
      setError('Please agree to the Terms & Conditions and Privacy Policy to log in.');
      return;
    }
    setLoading(true);
    try {
      const creds = parseAuthCredentials(email, password, { mode: 'login' });
      if (!creds.ok) {
        setError(creds.error);
        return;
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (err) throw err;
      router.replace('/(tabs)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={{ padding: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          scrollEnabled={canScroll || keyboardOpen}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          onLayout={(e) => updateScroll(e.nativeEvent.layout.height, 0)}
          contentContainerStyle={{ flexGrow: 0 }}
        >
          <View
            style={{ padding: theme.spacing.md }}
            onLayout={(e) => updateScroll(0, e.nativeEvent.layout.height)}
          >
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <Image
              source={authLogo}
              style={{ width: 280, height: 168 }}
              resizeMode="contain"
              accessibilityLabel="Water Chaste"
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text variant="title" weight="extrabold">
            Login
          </Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            Sign in to place an order.
          </Text>

          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <Card>
              <View style={{ gap: 10 }}>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={(t) => setEmail(sanitizeAuthEmail(t))}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  maxLength={254}
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={(t) => setPassword(sanitizeAuthPassword(t))}
                  placeholder="Enter your password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  passwordToggleable
                  maxLength={128}
                />
                <LegalAcceptanceRow checked={accepted} onToggle={() => setAccepted((v) => !v)} />
                {error ? (
                  <Text weight="bold" style={{ color: theme.colors.danger }}>
                    {error}
                  </Text>
                ) : null}
                <Button title={loading ? 'Please wait…' : 'Login'} disabled={loading || !accepted} onPress={submit} />
              </View>
            </Card>

            <Pressable onPress={() => router.push('/(auth)/sign-up')} style={{ alignItems: 'center' }}>
              <Text weight="bold" style={{ color: theme.colors.primary }}>
                Create account
              </Text>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

