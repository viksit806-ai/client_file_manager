import { View, Text, StyleSheet } from 'react-native';
import { getSlaColor, getSlaBg, getSlaLabel } from '../lib/utils';

export default function SlaBadge({ slaStatus }) {
  if (!slaStatus) return null;
  const bgColor = getSlaBg(slaStatus);
  const textColor = getSlaColor(slaStatus);
  const label = getSlaLabel(slaStatus);

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
  },
});
