import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import StatusBadge from './StatusBadge';
import { formatDateTime, truncateText } from '../lib/utils';

export default function DocumentCard({ document, onPress }) {
  const doc = document || {};
  const title = doc.title || doc.originalName || 'Untitled';
  const department = doc.departmentId?.name || '';
  const category = doc.categoryId?.name || '';
  const date = formatDateTime(doc.createdAt);
  const displayStatus = doc.paymentBlocked ? 'blocked' : doc.status;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <FileText size={20} color="#2563eb" />
        </View>
        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>
            {truncateText(title, 45)}
          </Text>
          <View style={styles.metaRow}>
            {department ? <Text style={styles.meta}>{department}</Text> : null}
            {category ? (
              <>
                <Text style={styles.metaSep}>{'\u2022'}</Text>
                <Text style={styles.meta}>{category}</Text>
              </>
            ) : null}
          </View>
        </View>
        <StatusBadge status={displayStatus} />
      </View>
      <Text style={styles.date}>{date}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleArea: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 12,
    color: '#64748b',
  },
  metaSep: {
    fontSize: 10,
    color: '#94a3b8',
    marginHorizontal: 4,
  },
  date: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 48,
  },
});
