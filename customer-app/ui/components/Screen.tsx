import { useEffect, type PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../theme';

type ScreenProps = PropsWithChildren<
  ViewProps & {
    backgroundColor?: string;
    safeAreaEdges?: Edge[];
    /** Fade and rise when this tab becomes active. */
    enter?: boolean;
  }
>;

export function Screen({ children, style, backgroundColor, safeAreaEdges, enter = false, ...rest }: ScreenProps) {
  const focused = useIsFocused();
  const opacity = useSharedValue(enter ? 0 : 1);
  const shift = useSharedValue(enter ? 16 : 0);

  useEffect(() => {
    if (!enter) return;
    if (!focused) return;
    opacity.value = 0;
    shift.value = 16;
    opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    shift.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [enter, focused, opacity, shift]);

  const motionStyle = useAnimatedStyle(() => ({
    flex: 1,
    alignItems: 'center' as const,
    opacity: opacity.value,
    transform: [{ translateY: shift.value }],
  }));

  const flatBg = backgroundColor ?? theme.colors.bg;
  const edges = safeAreaEdges ?? (['top', 'left', 'right'] as Edge[]);
  const Frame = enter ? Animated.View : View;

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: flatBg }}>
      {backgroundColor ? (
        <Frame style={enter ? motionStyle : { flex: 1, alignItems: 'center' }}>
          <View
            {...rest}
            style={[
              {
                flex: 1,
                width: '100%',
                maxWidth: 720,
                padding: theme.spacing.md,
              },
              style,
            ]}
          >
            {children}
          </View>
        </Frame>
      ) : (
        <LinearGradient
          colors={[theme.colors.bgSoft, theme.colors.bg, theme.colors.bgTint]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          <Frame style={enter ? motionStyle : { flex: 1, alignItems: 'center' }}>
            <View
              {...rest}
              style={[
                {
                  flex: 1,
                  width: '100%',
                  maxWidth: 720,
                  padding: theme.spacing.md,
                },
                style,
              ]}
            >
              {children}
            </View>
          </Frame>
        </LinearGradient>
      )}
    </SafeAreaView>
  );
}
