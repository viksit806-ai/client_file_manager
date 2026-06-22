import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Lock,
  Download,
} from 'lucide-react-native';
import { customerAPI } from '../../src/lib/api';
import StatusBadge from '../../src/components/StatusBadge';
import SlaBadge from '../../src/components/SlaBadge';
import PaymentModal from '../../src/components/PaymentModal';
import { formatDateTime, formatFileSize, getSlaStatus } from '../../src/lib/utils';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (id) {
      customerAPI
        .getDocuments()
        .then((res) => {
          const docs = res.data.data || [];
          const found = docs.find((d) => d._id === id);
          if (found) {
            setDoc(found);
          } else {
            Alert.alert('Error', 'Document not found');
            router.back();
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Failed to load document');
          router.back();
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleDownload = async (type) => {
    if (type === 'result' && doc?.paymentBlocked) {
      setShowPaymentModal(true);
      return;
    }
    setDownloading(true);
    setDownloadType(type);
    try {
      const response = await customerAPI.downloadDocument(id, type);
      const blob = response.data;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const rawName = type === 'result'
          ? (doc.resultFile?.originalName || 'result.pdf')
          : (doc.originalName || 'submission.pdf');
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
      if (err.response?.status === 403) {
        setShowPaymentModal(true);
      } else if (err.response?.status === 410) {
        Alert.alert('File Removed', 'This file has been purged from storage.');
      } else {
        Alert.alert('Download Failed', err.response?.data?.message || 'Could not download the file');
      }
    } finally {
      setDownloading(false);
      setDownloadType(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!doc) return null;

  const displayStatus = doc.paymentBlocked ? 'blocked' : doc.status;
  const hasResult = doc.resultFile && doc.resultFile.originalName;
  const slaStatus = getSlaStatus(doc.createdAt, displayStatus);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={2}>
              {doc.title || doc.originalName || 'Document'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <StatusBadge status={displayStatus} />
          {slaStatus && displayStatus !== 'completed' && displayStatus !== 'blocked' ? (
            <SlaBadge slaStatus={slaStatus} />
          ) : null}
        </View>

        {doc.paymentBlocked && (
          <View style={styles.blockedBanner}>
            <Lock size={18} color="#dc2626" style={{ marginBottom: 8 }} />
            <Text style={styles.blockedTitle}>Document Blocked</Text>
            <Text style={styles.blockedText}>
              This document has been blocked due to payment. Please contact the firm to resolve this.
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <InfoRow label="Department" value={doc.departmentId?.name || '-'} />
          <InfoRow label="Category" value={doc.categoryId?.name || '-'} />
          <InfoRow label="Created" value={formatDateTime(doc.createdAt)} />
          <InfoRow label="Last Updated" value={formatDateTime(doc.updatedAt)} />
          {doc.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.descText}>{doc.description}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.filesSection}>
          <Text style={styles.sectionTitle}>Files</Text>

          <TouchableOpacity
            style={[styles.fileBtn, { borderColor: '#2563eb' }]}
            onPress={() => handleDownload('submission')}
            disabled={downloading}
            activeOpacity={0.7}
          >
            <View style={styles.fileBtnLeft}>
              <FileText size={22} color="#2563eb" style={{ marginRight: 14 }} />
              <View>
                <Text style={styles.fileBtnTitle}>Submission File</Text>
                <Text style={styles.fileBtnSize}>{formatFileSize(doc.fileSize)}</Text>
              </View>
            </View>
            {downloading && downloadType === 'submission' ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <Download size={16} color="#2563eb" />
            )}
          </TouchableOpacity>

          {hasResult && (
            <TouchableOpacity
              style={[
                styles.fileBtn,
                { borderColor: '#16a34a', opacity: doc.paymentBlocked ? 0.5 : 1 },
              ]}
              onPress={() => handleDownload('result')}
              disabled={downloading || doc.paymentBlocked}
              activeOpacity={0.7}
            >
              <View style={styles.fileBtnLeft}>
                <CheckCircle size={22} color="#16a34a" style={{ marginRight: 14 }} />
                <View>
                  <Text style={styles.fileBtnTitle}>Result File</Text>
                  <Text style={styles.fileBtnSize}>
                    {formatFileSize(doc.resultFile?.fileSize)}
                  </Text>
                </View>
              </View>
              {doc.paymentBlocked ? (
                <Lock size={16} color="#dc2626" />
              ) : downloading && downloadType === 'result' ? (
                <ActivityIndicator color="#16a34a" size="small" />
              ) : (
                <Download size={16} color="#16a34a" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

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

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 26,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  blockedBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
  },
  blockedText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  descSection: {
    paddingTop: 10,
  },
  descLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  descText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  filesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  fileBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  fileBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  fileBtnSize: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
