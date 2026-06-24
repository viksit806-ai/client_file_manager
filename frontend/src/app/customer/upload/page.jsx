'use client';
import { useState, useEffect, useRef } from 'react';
import { customerAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Upload as UploadIcon } from 'lucide-react';

export default function CustomerUploadPage() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [requiresResult, setRequiresResult] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    customerAPI.getDepartments()
      .then(res => {
        setDepartments(res.data.data);
      })
      .catch(console.error);
  }, []);

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast.error('You can upload at most 10 files at once.');
      return;
    }
    const invalid = selectedFiles.filter(f => !ALLOWED_TYPES.includes(f.type));
    if (invalid.length > 0) {
      toast.error(`File type not allowed: ${invalid.map(f => f.name).join(', ')}. Allowed: PDF, images, Word, Excel, text.`);
      return;
    }
    const oversized = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.error(`File too large: ${oversized.map(f => f.name).join(', ')}. Maximum size is 50MB per file.`);
      return;
    }
    setFiles(prev => [...prev, ...selectedFiles]);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    const valid = dropped.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    if (files.length + valid.length > 10) {
      toast.error('You can upload at most 10 files at once.');
      return;
    }
    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
    if (dropped.length > valid.length) {
      toast.error(`${dropped.length - valid.length} file(s) skipped - invalid type or too large`);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (files.length > 0 || description.trim() !== '') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [files, description]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedDept) {
      toast.error('Select a department');
      return;
    }
    if (files.length === 0) {
      toast.error('Please select at least one file to upload');
      return;
    }

    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) {
      toast.error('Description cannot exceed 500 words');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('departmentId', selectedDept);
    formData.append('description', description);
    formData.append('requiresResult', requiresResult);
    files.forEach(f => {
      formData.append('files', f);
    });

    try {
      await customerAPI.uploadDocument(formData);
      toast.success('Documents uploaded successfully');
      setFiles([]);
      setDescription('');
      setSelectedDept('');
      setRequiresResult(true);
      if (e.target) e.target.reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getWordCount = () => {
    return description.trim().split(/\s+/).filter(Boolean).length;
  };

  return (
    <div>
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-blue-600/10 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border-2 border-dashed border-blue-400">
            <UploadIcon className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-700">Drop files here</p>
            <p className="text-sm text-gray-500 mt-1">PDF, images, Word, Excel</p>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">Upload Documents</h1>

      <div className="max-w-lg">
        <form onSubmit={handleUpload} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }} onDrop={handleDrop} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" required>
              <option value="">Select department</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Provide a description of the request (max 500 words)..."
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Limit: 500 words</span>
              <span className={getWordCount() > 500 ? 'text-red-500 font-bold' : ''}>
                Words: {getWordCount()} / 500
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="requiresResult"
              checked={requiresResult}
              onChange={(e) => setRequiresResult(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="requiresResult" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
              Requires response/result file in return
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Select Files</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-400 mt-1">Allowed: PDF, images, Word, Excel, text — Max 50MB per file</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 border p-3 rounded-lg bg-white">
              <p className="text-xs font-semibold text-gray-500 uppercase">Selected Files ({files.length}/10)</p>
              <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 text-xs text-gray-700">
                    <span className="truncate max-w-[250px]" title={`Name: ${f.name}\nSize: ${(f.size / 1024 / 1024).toFixed(2)} MB\nType: ${f.type}`}>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <UploadIcon className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
