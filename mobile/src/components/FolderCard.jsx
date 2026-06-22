import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Folder } from 'lucide-react-native';

export default function FolderCard({ item, onPress, onLongPress }) {
  const countLabel =
    item.itemCount != null
      ? `${item.itemCount} item${item.itemCount !== 1 ? 's' : ''}`
      : '';

  const folderColor = item.type === 'request' ? '#3b82f6' : '#f59e0b';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      activeOpacity={0.7}
    >
      <Folder size={40} color={folderColor} style={styles.icon} />
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      {countLabel ? <Text style={styles.count}>{countLabel}</Text> : null}
      {item.slaStatus ? (
        <View
          style={[
            styles.slaDot,
            {
              backgroundColor:
                item.slaStatus === 'overdue'
                  ? '#dc2626'
                  : item.slaStatus === 'approaching'
                    ? '#d97706'
                    : '#059669',
            },
          ]}
        />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  icon: {
    marginBottom: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 18,
  },
  count: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  slaDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
