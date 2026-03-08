import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDriverI18n } from '../i18n/useDriverI18n';
import { colors, radius, spacing, typography } from '../theme';

const SUPPORT_NUMBER = '9844259899';

export function SupportFab() {
  const { t } = useDriverI18n();

  const callSupport = async () => {
    const url = `tel:${SUPPORT_NUMBER}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Pressable style={styles.button} onPress={() => void callSupport()}>
        <Text style={styles.title}>{t('home.support')}</Text>
        <Text style={styles.sub}>{SUPPORT_NUMBER}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: spacing.md,
    bottom: 86,
    zIndex: 40
  },
  button: {
    borderRadius: radius.md,
    backgroundColor: '#0F172A',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 132,
    alignItems: 'center'
  },
  title: {
    color: '#ECFEFF',
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  sub: {
    marginTop: 2,
    color: '#93C5FD',
    fontFamily: typography.body,
    fontSize: 11
  }
});
