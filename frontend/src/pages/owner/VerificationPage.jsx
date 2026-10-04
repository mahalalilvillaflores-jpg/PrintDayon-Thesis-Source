import { useState, useEffect } from 'react';
import { shopAPI } from '../../services/api';
import {
  ShieldCheck, FileText, Upload, Eye, History,
  ExternalLink, X, Calendar, AlertCircle, Clock,
  CheckCircle2, AlertTriangle, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

function getDocStatusInfo(doc) {
  const current = doc?.currentFile;
  if (!current || !current.fileUrl) {
    return {
      status: 'pending_upload',
      label: 'Pending Upload',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
      dotClass: 'bg-slate-400',
      alert: null,
    };
  }

  if (current.status === 'rejected') {
    return {
      status: 'rejected',
      label: 'Rejected',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
      dotClass: 'bg-rose-500',
      alert: current.rejectionReason || 'Document was rejected by platform administrator.',
    };
  }

  if (current.expiresAt) {
    const expDate = new Date(current.expiresAt);
    const now = new Date();
    if (expDate < now) {
      return {
        status: 'expired',
        label: 'Expired',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
        dotClass: 'bg-rose-500',
        alert: 'Document is expired — Please upload an updated renewal document immediately.',
      };
    }
    const daysUntilExp = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExp <= 30) {
      return {
        status: 'expiring_soon',
        label: 'Expiring Soon',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
        dotClass: 'bg-amber-500',
        alert: `Document expires in ${daysUntilExp} day${daysUntilExp === 1 ? '' : 's'} on ${expDate.toLocaleDateString()}. Please prepare renewal document.`,
      };
    }
  }

  if (current.status === 'verified') {
    return {
      status: 'verified',
      label: 'Verified',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
      alert: null,
    };
  }

  return {
    status: 'pending',
    label: 'Pending Verification',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-sky-400',
    dotClass: 'bg-blue-500',
    alert: 'Newly uploaded document is waiting for administrator review.',
  };
}

export default function VerificationPage() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Document Modal States
  const [replaceModalDoc, setReplaceModalDoc] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceDocNumber, setReplaceDocNumber] = useState('');
  const [replaceExpiresAt, setReplaceExpiresAt] = useState('');
  const [replacingDoc, setReplacingDoc] = useState(false);

  const [previewModalDoc, setPreviewModalDoc] = useState(null);
  const [expandedHistoryDoc, setExpandedHistoryDoc] = useState(null);

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      setShop(res.data);
    } catch (err) {
      toast.error('Could not load business documents');
    } finally {
      setLoading(false);
    }
  };

  const openReplaceModal = (doc) => {
    setReplaceModalDoc(doc);
    setReplaceFile(null);
    setReplaceDocNumber(doc?.currentFile?.docNumber || doc?.docNumber || '');
    if (doc?.currentFile?.expiresAt) {
      setReplaceExpiresAt(doc.currentFile.expiresAt.slice(0, 10));
    } else {
      setReplaceExpiresAt('');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!replaceFile) {
      toast.error('Please choose a document file (PDF or image)');
      return;
    }

    setReplacingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      if (replaceDocNumber.trim()) {
        formData.append('docNumber', replaceDocNumber.trim());
      }
      if (replaceExpiresAt) {
        formData.append('expiresAt', replaceExpiresAt);
      }

      await shopAPI.replaceBusinessDocument(replaceModalDoc.type, formData);
      toast.success('Document uploaded and submitted for administrator verification!');
      setReplaceModalDoc(null);
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setReplacingDoc(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading verification credentials...
      </div>
    );
  }

  // Ensure documents array has DTI and Mayor's Permit
  const docs = (shop?.businessDocuments && shop.businessDocuments.length > 0)
    ? shop.businessDocuments
    : [
        {
          type: 'dti',
          title: 'DTI Business Name Registration',
          docNumber: shop?.dtiNumber || '',
          currentFile: {
            fileName: shop?.dtiDocName || '',
            fileUrl: shop?.dtiDocUrl || '',
            status: shop?.verificationStatus === 'verified' ? 'verified' : 'pending',
          },
          history: [],
        },
        {
          type: 'mayors_permit',
          title: "Mayor's / Business Permit",
          docNumber: shop?.mayorsPermitNumber || '',
          currentFile: {
            fileName: shop?.permitDocName || '',
            fileUrl: shop?.permitDocUrl || '',
            status: shop?.verificationStatus === 'verified' ? 'verified' : 'pending',
          },
          history: [],
        },
      ];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#465FFF] dark:text-sky-400">
            <ShieldCheck size={20} />
          </span>
          <h1 className="text-xl font-black text-[#101828] dark:text-white m-0">
            Business Verification &amp; Credentials
          </h1>
        </div>
        <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 mb-0">
          Upload and maintain your official business credentials (DTI Registration &amp; Mayor's Permit).
        </p>
      </div>

      {/* Confidentiality Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
        <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <strong>Confidential &amp; Private:</strong> These documents are stored securely and inspected exclusively by platform administrators to verify legitimate business identity. <strong>They are never shown publicly to customers.</strong>
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {docs.map((doc) => {
          const statusInfo = getDocStatusInfo(doc);
          const current = doc.currentFile;
          const hasFile = current && current.fileUrl;

          return (
            <div
              key={doc.type}
              className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {/* Title & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">{doc.title}</h2>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      {doc.docNumber || current?.docNumber ? `No: ${doc.docNumber || current.docNumber}` : 'No document number provided'}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    {statusInfo.label}
                  </span>
                </div>

                {/* Alert Message (Expiring, Expired, Rejected) */}
                {statusInfo.alert && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight">
                      {statusInfo.alert}
                    </span>
                  </div>
                )}

                {/* File Details Card */}
                {hasFile ? (
                  <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Uploaded File:</span>
                      <span className="font-bold text-[#101828] dark:text-white truncate max-w-[180px]">
                        {current.fileName || 'Uploaded Document'}
                      </span>
                    </div>

                    {current.uploadedAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Date Uploaded:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {new Date(current.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}

                    {current.expiresAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Expires On:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {new Date(current.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                    No document uploaded yet. Upload a copy to verify your printing business.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {hasFile && (
                    <button
                      type="button"
                      onClick={() => setPreviewModalDoc(doc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      <Eye size={14} /> Preview
                    </button>
                  )}
                  {doc.history && doc.history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryDoc(expandedHistoryDoc === doc.type ? null : doc.type)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      <History size={14} /> History ({doc.history.length})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openReplaceModal(doc)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs transition-all border-none cursor-pointer"
                >
                  <Upload size={14} /> {hasFile ? 'Upload Renewal' : 'Upload Document'}
                </button>
              </div>

              {/* Version History Accordion */}
              {expandedHistoryDoc === doc.type && doc.history?.length > 0 && (
                <div className="p-4 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    Archived Prior Versions
                  </div>
                  {doc.history.map((ver, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#101828] dark:text-white">{ver.fileName}</div>
                        <div className="text-[10px] text-slate-400">
                          Uploaded {new Date(ver.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <a
                        href={ver.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#465FFF] dark:text-sky-400 hover:underline"
                      >
                        <ExternalLink size={12} /> View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload/Replace Modal */}
      {replaceModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-[#101828] dark:text-white m-0">
                Upload {replaceModalDoc.title}
              </h2>
              <button
                onClick={() => setReplaceModalDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Registration / Permit Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DTI-01234567 or BP-2026-0042"
                  value={replaceDocNumber}
                  onChange={(e) => setReplaceDocNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Document Expiration Date
                </label>
                <input
                  type="date"
                  value={replaceExpiresAt}
                  onChange={(e) => setReplaceExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Document File (PDF, JPG, or PNG)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#465FFF] hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-sky-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceModalDoc(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replacingDoc || !replaceFile}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-sm transition-all border-none cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  {replacingDoc ? 'Uploading...' : 'Submit Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">
                {previewModalDoc.title}
              </h2>
              <button
                onClick={() => setPreviewModalDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[60vh] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
              {previewModalDoc.currentFile?.fileType?.startsWith('image') || previewModalDoc.currentFile?.fileUrl?.match(/\.(jpg|jpeg|png)$/i) ? (
                <img
                  src={previewModalDoc.currentFile.fileUrl}
                  alt={previewModalDoc.title}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={previewModalDoc.currentFile?.fileUrl}
                  title="Document Preview"
                  className="w-full h-full border-none"
                />
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-400 font-mono">
                {previewModalDoc.currentFile?.fileName}
              </span>
              <a
                href={previewModalDoc.currentFile?.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold no-underline hover:bg-slate-900"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
