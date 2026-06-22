import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Folder,
  FileText,
  Building2,
  ChevronRight,
  ArrowLeft,
  Download,
  Lock,
  CheckCircle,
  Clock,
  ArrowUpDown,
} from 'lucide-react-native';
import { customerAPI } from '../../src/lib/api';
import StatusBadge from '../../src/components/StatusBadge';
import { formatDateTime, formatFileSize } from '../../src/lib/utils';

const SORT_OPTIONS = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'size', label: 'Size' },
];

export default function CategoriesScreen() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const insets = useSafeAreaInsets();

  const fetchData = async () => {
    try {
      const res = await customerAPI.getCategories();
      setGrouped(res.data.data || {});
    } catch (err) {
      console.log('Categories fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const sortedDocs = useMemo(() => {
    if (!selectedCat?.documents) return [];
    const docs = [...selectedCat.documents];
    docs.sort((a, b) => {
      let comp = 0;
      if (sortField === 'date') {
        comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else if (sortField === 'name') {
        comp = (a.title || a.originalName || '').localeCompare(b.title || b.originalName || '');
      } else if (sortField === 'status') {
        comp = (a.status || '').localeCompare(b.status || '');
      } else if (sortField === 'size') {
        comp = (a.fileSize || 0) - (b.fileSize || 0);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
    return docs;
  }, [selectedCat, sortField, sortOrder]);

  const handleDownloadResult = async (doc) => {
    if (doc.paymentBlocked) {
      Alert.alert('Payment Due', 'Payment is due. Please contact the firm.');
      return;
    }
    if (doc.resultFileDeletedFromStorage) {
      Alert.alert('File Removed', 'The result file has been removed from storage.');
      return;
    }
    try {
      const res = await customerAPI.downloadDocument(doc._id, 'result');
      const blob = res.data;
      const reader = new FileReader();
      reader.onload = async () => {
        const { FileSystem } = require('expo-file-system');
        const { Sharing } = require('expo-sharing');
        const base64 = reader.result.split(',')[1];
        const rawName = doc.resultFile?.originalName || 'result.pdf';
        const safeName = rawName.replace(/[/\\:*?"<>|]/g, '_');
        const localUri = `${FileSystem.cacheDirectory}${safeName}`;
        await FileSystem.writeAsStringAsync(localUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Alert.alert('Downloaded', `File saved to: ${localUri}`);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      Alert.alert('Download Failed', err.response?.data?.message || 'Could not download the file');
    }
  };

  const deptNames = Object.keys(grouped);

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (selectedCat) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setSelectedCat(null)} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.subHeaderInfo}>
            <Text style={styles.subHeaderTitle}>{selectedCat.name}</Text>
            {selectedCat.description ? (
              <Text style={styles.subHeaderDesc}>{selectedCat.description}</Text>
            ) : null}
          </View>
          <Text style={styles.docCount}>{sortedDocs.length} doc{sortedDocs.length !== 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.sortBar}>
          <ArrowUpDown size={12} color="#94a3b8" style={{ marginRight: 6 }} />
          <Text style={styles.sortLabel}>Sort by:</Text>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sortField === opt.key && styles.sortChipActive]}
              onPress={() => {
                if (sortField === opt.key) {
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField(opt.key);
                  setSortOrder('desc');
                }
              }}
            >
              <Text style={[styles.sortChipText, sortField === opt.key && styles.sortChipTextActive]}>
                {opt.label} {sortField === opt.key ? (sortOrder === 'asc' ? '\u2191' : '\u2193') : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={sortedDocs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.docList}
          renderItem={({ item: doc }) => {
            const displayStatus = doc.paymentBlocked ? 'blocked' : doc.status;
            return (
              <View style={styles.docRow}>
                <View style={styles.docInfo}>
                  <FileText size={18} color="#2563eb" style={styles.docIcon} />
                  <View style={styles.docMeta}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {doc.title || doc.originalName}
                    </Text>
                    <Text style={styles.docSub}>
                      {formatDateTime(doc.createdAt)}
                      {doc.fileSize ? ` \u2022 ${formatFileSize(doc.fileSize)}` : ''}
                      {doc.departmentId?.name ? ` \u2022 ${doc.departmentId.name}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.docActions}>
                  <StatusBadge status={displayStatus} />
                  {doc.resultFile && !doc.resultFileDeletedFromStorage && !doc.paymentBlocked ? (
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => handleDownloadResult(doc)}
                    >
                      <Download size={14} color="#059669" />
                    </TouchableOpacity>
                  ) : null}
                  {doc.resultFile && doc.paymentBlocked ? (
                    <Lock size={16} color="#dc2626" />
                  ) : null}
                  {!doc.resultFile && doc.status === 'completed' ? (
                    <CheckCircle size={16} color="#16a34a" />
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Folder size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No documents in this category yet</Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Document Categories</Text>
          <Text style={styles.screenSubtitle}>Browse documents by department and category</Text>
        </View>

        {deptNames.length === 0 ? (
          <View style={styles.emptyState}>
            <Folder size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No categories available yet</Text>
          </View>
        ) : (
          deptNames.map((deptName) => (
            <View key={deptName} style={styles.deptSection}>
              <View style={styles.deptHeader}>
                <Building2 size={18} color="#64748b" style={{ marginRight: 10 }} />
                <Text style={styles.deptName}>{deptName}</Text>
              </View>
              {grouped[deptName].map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={styles.categoryRow}
                  onPress={() => setSelectedCat(cat)}
                  activeOpacity={0.7}
                >
                  <View style={styles.catIconWrap}>
                    <Folder size={18} color="#3b82f6" />
                  </View>
                  <View style={styles.catInfo}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.catMeta}>
                      {cat.documents?.length || 0} document{(cat.documents?.length || 0) !== 1 ? 's' : ''}
                      {cat.description ? ` \u2022 ${cat.description}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  deptSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  deptName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  catMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subHeaderInfo: {
    flex: 1,
  },
  subHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  subHeaderDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  docCount: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  sortChipActive: {
    backgroundColor: '#eff6ff',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  sortChipTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  docList: {
    padding: 16,
    paddingBottom: 40,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  docIcon: {
    marginRight: 10,
  },
  docMeta: {
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  docSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 12,
  },
});
