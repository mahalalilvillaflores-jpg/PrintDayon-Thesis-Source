import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const ACCEPTED_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
const MAX_SIZE_MB = 25;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ onFileSelect, accept = ACCEPTED_TYPES.join(','), maxSizeMB = MAX_SIZE_MB }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const validate = useCallback((f) => {
    if (!f) return 'No file selected.';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) return `Unsupported file type. Use: ${ACCEPTED_TYPES.join(', ')}`;
    if (f.size > maxSizeMB * 1024 * 1024) return `File exceeds ${maxSizeMB} MB limit.`;
    return null;
  }, [maxSizeMB]);

  const handleFile = useCallback((f) => {
    const err = validate(f);
    if (err) { setError(err); return; }
    setError('');
    setFile(f);
    onFileSelect?.(f);
  }, [validate, onFileSelect]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const removeFile = () => { setFile(null); setError(''); onFileSelect?.(null); };

  return (
    <div>
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `1.5px dashed ${dragging ? '#19398d' : error ? '#9b0033' : '#e3e3e3'}`,
            borderRadius: '1rem',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            background: dragging ? '#eef2fc' : '#ffffff',
            transition: 'all 0.15s ease',
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <input
            id="file-upload-input"
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={onInputChange}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem',
              background: dragging ? '#d2defc' : '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={24} color={dragging ? '#19398d' : '#64748b'} />
            </div>
          </div>
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
            Drop your file here, or <span style={{ color: '#19398d', textDecoration: 'underline' }}>browse</span>
          </p>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Supported: {ACCEPTED_TYPES.join(', ')} &nbsp;•&nbsp; Max {maxSizeMB} MB
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1rem 1.25rem',
          border: '1.5px solid #bbf7d0',
          borderRadius: '1rem',
          background: '#f0fdf4',
        }}>
          <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={20} color="#16a34a" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, color: '#166534', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
            <p style={{ fontSize: '0.75rem', color: '#16a34a' }}>
              {formatBytes(file.size)} &nbsp;•&nbsp;
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={12} /> Uploaded successfully
              </span>
            </p>
          </div>
          <button
            onClick={removeFile}
            aria-label="Remove file"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#DC2626', fontSize: '0.8rem' }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
