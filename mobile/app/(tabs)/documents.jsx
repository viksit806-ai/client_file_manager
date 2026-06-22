import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Folder,
  FileText,
  CheckCircle,
  Search,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Grid3X3,
  List,
  ArrowUpDown,
  Download,
  Lock,
  Info,
  Settings,
  Upload,
  HardDrive,
  X,
} from 'lucide-react-native';
import { customerAPI } from '../../src/lib/api';
import StatusBadge from '../../src/components/StatusBadge';
import SlaBadge from '../../src/components/SlaBadge';
import DocumentCard from '../../src/components/DocumentCard';
import FolderCard from '../../src/components/FolderCard';
import PaymentModal from '../../src/components/PaymentModal';
import { formatDateTime, formatFileSize, getSlaStatus } from '../../src/lib/utils';

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
];

export default function DocumentsExplorerScreen() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid');

  const [currentPath, setCurrentPath] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await customerAPI.getDocuments();
      setDocuments(res.data.data || []);
    } catch (err) {
      console.log('Documents fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const navigateToPath = (newPath) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newPath);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setCurrentPath(newPath);
    setSelectedItem(null);
    setShowDetails(false);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
      setSelectedItem(null);
      setShowDetails(false);
    }
  };

  const handleUp = () => {
    if (currentPath.length > 0) {
      navigateToPath(currentPath.slice(0, -1));
    }
  };

  const groupedByDept = useMemo(() => {
    const groups = {};
    for (const doc of documents) {
      const deptId = doc.departmentId?._id || 'general';
      const deptName = doc.departmentId?.name || 'General';
      if (!groups[deptId]) {
        groups[deptId] = { id: deptId, name: deptName, docs: [] };
      }
      groups[deptId].docs.push(doc);
    }
    return groups;
  }, [documents]);

  const isSearching = searchQuery.trim() !== '';

  const explorerItems = useMemo(() => {
    const currentDepth = currentPath.length;

    if (currentDepth === 0) {
      return Object.values(groupedByDept).map((dept) => ({
        id: dept.id,
        name: dept.name,
        type: 'dept',
        itemCount: dept.docs.length,
        docs: dept.docs,
      }));
    }

    if (currentDepth === 1) {
      const activeDeptId = currentPath[0].id;
      const deptData = groupedByDept[activeDeptId];
      if (!deptData) return [];
      const groups = {};
      for (const d of deptData.docs) {
        const key = d.groupId || d._id;
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      }
      return Object.entries(groups).map(([groupId, groupDocs]) => {
        const firstDoc = groupDocs[0];
        const status = groupDocs.some((d) => d.paymentBlocked || d.status === 'blocked')
          ? 'blocked'
          : groupDocs.every((d) => d.status === 'completed')
            ? 'completed'
            : groupDocs.some((d) => d.status === 'processing')
              ? 'processing'
              : 'pending';
        return {
          id: groupId,
          name: firstDoc.customGroupName || formatDateTime(firstDoc.createdAt),
          type: 'request',
          itemCount: groupDocs.length,
          status,
          slaStatus: getSlaStatus(firstDoc.createdAt, status),
          docs: groupDocs,
        };
      });
    }

    if (currentDepth === 2) {
      const activeDeptId = currentPath[0].id;
      const activeGroupId = currentPath[1].id;
      const deptData = groupedByDept[activeDeptId];
      if (!deptData) return [];
      const groupDocs = deptData.docs.filter(
        (d) => (d.groupId || d._id) === activeGroupId && !d.isPlaceholder && d.storedPath
      );
      const items = [];
      for (const d of groupDocs) {
        items.push({
          id: d._id,
          name: d.title || d.originalName || 'Untitled',
          type: 'submission',
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          status: d.status,
          createdAt: d.createdAt,
          doc: d,
        });
        if (d.resultFile) {
          items.push({
            id: `${d._id}_result`,
            name: `Result_${d.resultFile.originalName}`,
            type: 'result',
            fileSize: d.resultFile.fileSize,
            mimeType: d.mimeType,
            status: d.status,
            createdAt: d.resultFile.uploadedAt,
            doc: d,
          });
        }
      }
      return items;
    }

    return [];
  }, [currentPath, groupedByDept]);

  const sortedItems = useMemo(() => {
    const items = [...explorerItems];
    const isFolderType = (t) => t === 'dept' || t === 'request';
    items.sort((a, b) => {
      const aFolder = isFolderType(a.type);
      const bFolder = isFolderType(b.type);
      if (aFolder && !bFolder) return -1;
      if (!aFolder && bFolder) return 1;
      let comp = 0;
      if (sortField === 'name') comp = a.name.localeCompare(b.name);
      else if (sortField === 'type') comp = (a.type || '').localeCompare(b.type || '');
      else if (sortField === 'size') comp = (a.fileSize || 0) - (b.fileSize || 0);
      else if (sortField === 'status') comp = (a.status || '').localeCompare(b.status || '');
      else if (sortField === 'date')
        comp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return sortOrder === 'asc' ? comp : -comp;
    });
    return items;
  }, [explorerItems, sortField, sortOrder]);

  const handleItemPress = (item) => {
    if (item.type === 'dept') {
      navigateToPath([{ id: item.id, name: item.name, type: 'dept' }]);
    } else if (item.type === 'request') {
      navigateToPath([currentPath[0], { id: item.id, name: item.name, type: 'request' }]);
    } else {
      setSelectedItem(item);
      setShowDetails(true);
    }
  };

  const handleDownload = async (doc, type) => {
    if (type === 'result' && doc?.paymentBlocked) {
      setShowDetails(false);
      setShowPaymentModal(true);
      return;
    }
    try {
      const res = await customerAPI.downloadDocument(doc._id, type);
      const blob = res.data;
      const reader = new FileReader();
      reader.onload = async () => {
        const { FileSystem } = require('expo-file-system');
        const { Sharing } = require('expo-sharing');
        const base64 = reader.result.split(',')[1];
        const rawName =
          type === 'result'
            ? (doc.resultFile?.originalName || 'result.pdf')
            : (doc.originalName || 'submission.pdf');
        const safeName = rawName.replace(/[/\\:*?"<>|]/g, '_');
        const localUri = `${FileSystem.cacheDirectory}${safeName}`;
        await FileSystem.writeAsStringAsync(localUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      if (err.response?.status === 403) {
        setShowPaymentModal(true);
      } else if (err.response?.status === 410) {
        Alert.alert('File Removed', 'This file has been purged from storage.');
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const currentDepth = currentPath.length;

  const renderItem = ({ item }) => {
    const isFolder = item.type === 'dept' || item.type === 'request';
    if (viewMode === 'grid') {
      return (
        <View style={styles.gridItem}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.7}
          >
            {isFolder ? (
              <Folder
                size={40}
                color={item.type === 'request' ? '#3b82f6' : '#f59e0b'}
                style={styles.gridIcon}
              />
            ) : item.type === 'result' ? (
              <CheckCircle size={40} color="#16a34a" style={styles.gridIcon} />
            ) : (
              <FileText size={40} color="#2563eb" style={styles.gridIcon} />
            )}
            <Text style={styles.gridItemName} numberOfLines={2}>
              {item.name}
            </Text>
            {isFolder ? (
              <Text style={styles.gridItemCount}>
                {item.itemCount} item{item.itemCount !== 1 ? 's' : ''}
              </Text>
            ) : item.fileSize ? (
              <Text style={styles.gridItemCount}>{formatFileSize(item.fileSize)}</Text>
            ) : null}
            {item.slaStatus && item.status !== 'completed' && item.status !== 'blocked' ? (
              <View style={styles.gridBadge}>
                <SlaBadge slaStatus={item.slaStatus} />
              </View>
            ) : null}
            {item.status ? (
              <View style={styles.gridBadge}>
                <StatusBadge status={item.status} />
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.listRowLeft}>
          {isFolder ? (
            <Folder
              size={20}
              color={item.type === 'request' ? '#3b82f6' : '#f59e0b'}
              style={styles.listIcon}
            />
          ) : item.type === 'result' ? (
            <CheckCircle size={20} color="#16a34a" style={styles.listIcon} />
          ) : (
            <FileText size={20} color="#2563eb" style={styles.listIcon} />
          )}
          <View style={styles.listRowInfo}>
            <Text style={styles.listRowName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.listRowType}>
              {isFolder
                ? `${item.itemCount} items`
                : item.type === 'result'
                  ? 'Result File'
                  : 'Submission File'}
            </Text>
          </View>
        </View>
        <View style={styles.listRowRight}>
          {item.slaStatus && item.status !== 'completed' && item.status !== 'blocked' ? (
            <SlaBadge slaStatus={item.slaStatus} />
          ) : null}
          {item.status ? <StatusBadge status={item.status} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <FileText size={22} color="#2563eb" style={styles.headerIcon} />
            <Text style={styles.screenTitle}>My Documents</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Settings size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={handleBack}
            disabled={historyIndex === 0}
            style={[styles.navBtn, historyIndex === 0 && styles.navBtnDisabled]}
          >
            <ArrowLeft size={14} color={historyIndex === 0 ? '#cbd5e1' : '#334155'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUp}
            disabled={currentPath.length === 0}
            style={[styles.navBtn, currentPath.length === 0 && styles.navBtnDisabled]}
          >
            <ArrowUp size={14} color={currentPath.length === 0 ? '#cbd5e1' : '#334155'} />
          </TouchableOpacity>
          <View style={styles.breadcrumb}>
            <HardDrive size={12} color="#94a3b8" style={styles.breadcrumbIcon} />
            <Text style={styles.breadcrumbText} numberOfLines={1}>
              My Docs
              {currentPath.map((p) => `  ${p.name}`).join('')}
            </Text>
          </View>
        </View>

        <View style={styles.toolRow}>
          <View style={styles.searchBar}>
            <Search size={14} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search documents..."
              placeholderTextColor="#94a3b8"
            />
            {isSearching ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => {
              const idx = SORT_OPTIONS.findIndex((o) => o.key === sortField);
              const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
              setSortField(next.key);
            }}
          >
            <ArrowUpDown size={14} color="#64748b" />
            <Text style={styles.sortBtnText}>
              {SORT_OPTIONS.find((o) => o.key === sortField)?.label || 'Name'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sortOrderBtn}
            onPress={() => setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'))}
          >
            <Text style={styles.sortOrderText}>{sortOrder === 'asc' ? '\u2191' : '\u2193'}</Text>
          </TouchableOpacity>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <Grid3X3 size={14} color={viewMode === 'grid' ? '#2563eb' : '#94a3b8'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={14} color={viewMode === 'list' ? '#2563eb' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isSearching ? (
        <FlatList
          data={documents.filter((d) =>
            (d.title || d.originalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.description || '').toLowerCase().includes(searchQuery.toLowerCase())
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
          }
          renderItem={({ item }) => (
            <DocumentCard
              document={item}
              onPress={() => router.push(`/document/${item._id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FileText size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No matching documents</Text>
              <Text style={styles.emptyText}>Try a different search term</Text>
            </View>
          }
        />
      ) : viewMode === 'grid' ? (
        <FlatList
          key="grid"
          data={sortedItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Folder size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Folder is empty</Text>
              <Text style={styles.emptyText}>
                {currentDepth === 0 ? 'No documents available' : 'No files in this folder'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="list"
          data={sortedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Folder size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Folder is empty</Text>
              <Text style={styles.emptyText}>
                {currentDepth === 0 ? 'No documents available' : 'No files in this folder'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showDetails} transparent animationType="slide" onRequestClose={() => setShowDetails(false)}>
        <View style={styles.detailsOverlay}>
          <TouchableOpacity style={styles.detailsBackdrop} onPress={() => setShowDetails(false)} />
          <View style={styles.detailsSheet}>
            <View style={styles.detailsHandle} />
            <ScrollView>
              {selectedItem && (
                <>
                  <View style={styles.detailsHeader}>
                    {selectedItem.type === 'dept' || selectedItem.type === 'request' ? (
                      <Folder size={48} color="#3b82f6" />
                    ) : selectedItem.type === 'result' ? (
                      <CheckCircle size={48} color="#16a34a" />
                    ) : (
                      <FileText size={48} color="#2563eb" />
                    )}
                    <Text style={styles.detailsTitle}>{selectedItem.name}</Text>
                  </View>

                  <View style={styles.detailsMeta}>
                    <DetailRow label="Type" value={
                      selectedItem.type === 'dept'
                        ? 'Department Folder'
                        : selectedItem.type === 'request'
                          ? 'Request Batch'
                          : selectedItem.type === 'submission'
                            ? 'Submission File'
                            : 'Result Document'
                    } />
                    {selectedItem.status ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <StatusBadge status={selectedItem.status} />
                      </View>
                    ) : null}
                    {selectedItem.slaStatus && selectedItem.status !== 'completed' && selectedItem.status !== 'blocked' ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>SLA</Text>
                        <SlaBadge slaStatus={selectedItem.slaStatus} />
                      </View>
                    ) : null}
                    {selectedItem.fileSize ? (
                      <DetailRow label="Size" value={formatFileSize(selectedItem.fileSize)} />
                    ) : null}
                    {selectedItem.createdAt ? (
                      <DetailRow label="Date" value={formatDateTime(selectedItem.createdAt)} />
                    ) : null}
                    {selectedItem.doc?.description ? (
                      <View style={styles.detailDesc}>
                        <Text style={styles.detailLabel}>Description</Text>
                        <Text style={styles.detailDescText}>{selectedItem.doc.description}</Text>
                      </View>
                    ) : null}
                  </View>

                  {(selectedItem.type === 'submission' || selectedItem.type === 'result') && (
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => {
                        setShowDetails(false);
                        handleDownload(selectedItem.doc, selectedItem.type);
                      }}
                    >
                      <Download size={16} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.downloadBtnText}>
                        {selectedItem.doc?.paymentBlocked && selectedItem.type === 'result'
                          ? 'Payment Due'
                          : 'Download File'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onGoToCategories={() => {
          setShowPaymentModal(false);
          router.push('/(tabs)/categories');
        }}
      />
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 10,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  breadcrumb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  breadcrumbIcon: {
    marginRight: 6,
  },
  breadcrumbText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginLeft: 6,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
  },
  sortOrderBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortOrderText: {
    fontSize: 14,
    color: '#334155',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  viewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  viewBtnActive: {
    backgroundColor: '#eff6ff',
  },
  gridContent: {
    padding: 16,
    paddingBottom: 32,
  },
  gridRow: {
    gap: 8,
  },
  gridItem: {
    flex: 1,
  },
  gridCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  gridIcon: {
    marginBottom: 8,
  },
  gridItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  gridItemCount: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
  },
  gridBadge: {
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  listIcon: {
    marginRight: 10,
  },
  listRowInfo: {
    flex: 1,
  },
  listRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  listRowType: {
    fontSize: 11,
    color: '#94a3b8',
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  detailsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  detailsSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  detailsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  detailsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 8,
  },
  detailsMeta: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  detailDesc: {
    paddingTop: 12,
  },
  detailDescText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginTop: 4,
    fontStyle: 'italic',
  },
  downloadBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
