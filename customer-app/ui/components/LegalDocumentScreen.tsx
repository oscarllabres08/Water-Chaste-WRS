import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { LegalSection } from '../../lib/legalContent';
import { LEGAL_LAST_UPDATED } from '../../lib/legalContent';
import { Screen } from './Screen';
import { Text } from './Text';
import { theme } from '../theme';

type Props = {
  title: string;
  intro: string;
  icon: keyof typeof Ionicons.glyphMap;
  sections: LegalSection[];
};

function LegalBody({ body }: { body: string }) {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <View style={{ gap: 8 }}>
      {lines.map((line) => {
        const bullet = line.startsWith('•');
        const text = bullet ? line.replace(/^•\s*/, '') : line;
        if (!bullet) {
          return (
            <Text key={line} variant="muted" style={{ lineHeight: 22, fontSize: 14 }}>
              {text}
            </Text>
          );
        }
        return (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.accent,
                marginTop: 8,
              }}
            />
            <Text variant="muted" style={{ flex: 1, lineHeight: 22, fontSize: 14 }}>
              {text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function LegalDocumentScreen({ title, intro, icon, sections }: Props) {
  return (
    <Screen style={{ padding: 0 }} safeAreaEdges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 36, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[theme.colors.navyDeep, theme.colors.primaryDark, theme.colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 22, padding: 18, overflow: 'hidden' }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={24} color="#fff" />
          </View>
          <Text weight="extrabold" style={{ color: '#fff', fontSize: 22, marginTop: 12 }}>
            {title}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.88)', marginTop: 6, lineHeight: 20, fontSize: 14 }}>
            {intro}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 12,
              backgroundColor: 'rgba(255,255,255,0.16)',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text weight="bold" style={{ color: '#fff', fontSize: 12 }}>
              Last updated {LEGAL_LAST_UPDATED}
            </Text>
          </View>
        </LinearGradient>

        {sections.map((section, index) => (
          <View
            key={section.heading}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  backgroundColor: '#E5F4FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text weight="extrabold" style={{ color: theme.colors.primaryDark, fontSize: 13 }}>
                  {index + 1}
                </Text>
              </View>
              <Text weight="extrabold" style={{ flex: 1, fontSize: 15, color: theme.colors.primaryDark }}>
                {section.heading.replace(/^\d+\.\s*/, '')}
              </Text>
            </View>
            <LegalBody body={section.body} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
