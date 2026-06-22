import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Upload,
  Building2,
  FileText,
  Trash2,
  CheckSquare,
} from 'lucide-react-native';
import { customerAPI } from '../../src/lib/api';
import * as DocumentPicker from 'expo-document-picker';

export default function UploadTabScreen() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [requiresResult, setRequiresResult] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    customerAPI
      .getDepartments()
      .then((res) => setDepartments(res.data.data || []))
      .catch(() => Alert.alert('Error', 'Failed to load departments'))
      .finally(() => setLoading(false));
  }, []);

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpg',
  ];

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const oversized = result.assets.filter(f => f.size > 50 * 1024 * 1024);
        if (oversized.length > 0) {
          Alert.alert('File Too Large', `${oversized.map(f => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the 50MB limit.`);
          return;
        }
        setSelectedFiles((prev) => [...prev, ...result.assets]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedDept) {
      Alert.alert('Required', 'Please select a department');
      return;
    }
    if (selectedFiles.length === 0) {
      Alert.alert('Required', 'Please select at least one file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('departmentId', selectedDept._id);
      formData.append('requiresResult', requiresResult);
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      selectedFiles.forEach((file) => {
        const fileExt = file.name?.split('.').pop() || 'file';
        formData.append('files', {
          uri: file.uri,
          type: file.mimeType || `application/${fileExt}`,
          name: file.name || `file.${fileExt}`,
        });
      });

      await customerAPI.uploadDocument(formData);
      Alert.alert('Success', 'Documents uploaded successfully', [
        {
          text: 'View Documents',
          onPress: () => router.push('/(tabs)/documents'),
        },
        { text: 'Upload More', style: 'cancel' },
      ]);
      setSelectedFiles([]);
      setDescription('');
      setSelectedDept(null);
      setRequiresResult(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed. Please try again.';
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const wordCount = description.trim() ? description.trim().split(/\s+/).filter(Boolean).length : 0;
  const wordLimitReached = wordCount >= 500;

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading departments...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <Text style={styles.screenTitle}>Upload Documents</Text>
            <Text style={styles.screenSubtitle}>Submit your documents to any department</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Department</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowDeptPicker(!showDeptPicker)}
              activeOpacity={0.7}
            >
              <View style={styles.selectorLeft}>
                <Building2 size={16} color="#64748b" style={{ marginRight: 10 }} />
                <Text style={[styles.selectorText, !selectedDept && styles.placeholder]}>
                  {selectedDept ? selectedDept.name : 'Select a department'}
                </Text>
              </View>
              <Text style={styles.selectorArrow}>{showDeptPicker ? '\u25B2' : '\u25BC'}</Text>
            </TouchableOpacity>

            {showDeptPicker && (
              <View style={styles.pickerList}>
                {departments.length === 0 ? (
                  <Text style={styles.pickerEmpty}>No departments available</Text>
                ) : (
                  departments.map((dept) => (
                    <TouchableOpacity
                      key={dept._id}
                      style={[
                        styles.pickerItem,
                        selectedDept?._id === dept._id && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setSelectedDept(dept);
                        setShowDeptPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          selectedDept?._id === dept._id && styles.pickerItemTextActive,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you need..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!wordLimitReached}
            />
            <Text style={[styles.wordCount, wordLimitReached && styles.wordCountError]}>
              {wordCount}/500 words
              {wordLimitReached ? ' (Limit reached)' : ''}
            </Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <View style={styles.toggleTitleRow}>
                  <CheckSquare size={16} color="#2563eb" style={{ marginRight: 8 }} />
                  <Text style={styles.toggleLabel}>Requires result file</Text>
                </View>
                <Text style={styles.toggleDesc}>
                  Check if you need a response document back
                </Text>
              </View>
              <Switch
                value={requiresResult}
                onValueChange={setRequiresResult}
                trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                thumbColor={requiresResult ? '#2563eb' : '#ffffff'}
              />
            </View>

            <Text style={styles.label}>Files</Text>
            <TouchableOpacity
              style={styles.pickButton}
              onPress={pickFiles}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Upload size={20} color="#2563eb" style={{ marginRight: 8 }} />
              <Text style={styles.pickButtonText}>Select Files</Text>
            </TouchableOpacity>
            <Text style={styles.fileHint}>
              PDF, images, Word, Excel, text \u2022 Max 10 files
            </Text>

            {selectedFiles.length > 0 && (
              <View style={styles.fileList}>
                {selectedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileInfo}>
                      <FileText size={18} color="#2563eb" style={{ marginRight: 10 }} />
                      <View style={styles.fileMeta}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {file.name || `File ${index + 1}`}
                        </Text>
                        {file.size ? (
                          <Text style={styles.fileSize}>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFile(index)}
                      disabled={uploading}
                      style={styles.removeBtn}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.uploadButton,
                (uploading || selectedFiles.length === 0 || !selectedDept) &&
                  styles.uploadButtonDisabled,
              ]}
              onPress={handleUpload}
              disabled={uploading || selectedFiles.length === 0 || !selectedDept}
              activeOpacity={0.8}
            >
              {uploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.uploadButtonText}>  Uploading...</Text>
                </View>
              ) : (
                <View style={styles.uploadingRow}>
                  <Upload size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.uploadButtonText}>
                    Upload {selectedFiles.length > 0 ? `(${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''})` : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
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
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  selector: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  placeholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  selectorArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  pickerList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerEmpty: {
    padding: 16,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemActive: {
    backgroundColor: '#eff6ff',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#334155',
  },
  pickerItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 100,
    lineHeight: 20,
  },
  wordCount: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },
  wordCountError: {
    color: '#dc2626',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 24,
  },
  pickButton: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  fileHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  fileList: {
    marginBottom: 8,
  },
  fileItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  fileSize: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  removeBtn: {
    padding: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
