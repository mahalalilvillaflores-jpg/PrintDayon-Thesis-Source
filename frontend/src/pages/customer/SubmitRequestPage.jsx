import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { documentAPI, requestAPI, recommendationAPI, shopAPI } from '../../services/api';
import {
  Upload, FileText, ArrowLeft, ArrowRight,
  X, Store, MapPin, Zap, Clock,
  CheckCircle2, AlertCircle, RefreshCw,
  Star, Car, Printer, ArrowLeftRight, Check,
  CreditCard, Trash2
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';
import {
  calculatePrintJobPrice,
  parseCustomPageCount,
  formatPageRangeSummary,
} from '../../utils/pricingCalculator';

// 4-Step Customer Workflow
const WORKFLOW_STEPS = [
  { id: 1, title: 'Upload Document', short: 'Document' },
  { id: 2, title: 'Printing Preferences', short: 'Preferences' },
  { id: 3, title: 'Review & Confirm', short: 'Review & Confirm' },
  { id: 4, title: 'Track Request', short: 'Track Order' },
];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function SubmitRequestPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Selected shop from routing state (e.g. from Shop Detail or Find Shops)
  const [selectedShop, setSelectedShop] = useState(state?.shop || null);
  const [travelMode] = useState(state?.travelMode || 'motor');
  const fileInputRef = useRef(null);
  const proofInputRef = useRef(null);

  // Available shops for Change Shop modal
  const [availableShops, setAvailableShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  // Workflow step: 1 (Upload), 2 (Preferences), 3 (Review), 4 (Track/Success)
  const [activeStep, setActiveStep] = useState(1);

  // Document state
  const [file, setFile] = useState(null);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [detectedPages, setDetectedPages] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isProcessing = uploading || isDetecting || isAnalyzing;

  // Printing specifications state
  const [specs, setSpecs] = useState(() => {
    const passed = state?.specs ? { ...state.specs } : {};
    // Ensure totalPages is null if no document has been uploaded yet
    if (!state?.uploadedDoc && !state?.document) {
      delete passed.totalPages;
    }
    return {
      copies: 1,
      totalPages: null,
      serviceType: 'doc_print',
      paperSize: 'A4',
      paperType: 'bond',
      colorMode: 'black_and_white',
      sided: 'single',
      pageRange: 'all',
      binding: 'none',
      coverColor: 'maroon',
      additionalInstructions: '',
      ...passed,
      totalPages: (state?.uploadedDoc?.pageCount || state?.document?.pageCount) || null,
    };
  });

  const [customPageRange, setCustomPageRange] = useState('');
  const [isRush, setIsRush] = useState(false);

  // Auto-reset rush if selected shop does not allow rush orders
  useEffect(() => {
    if (selectedShop?.pricing && selectedShop.pricing.allowRush === false && isRush) {
      setIsRush(false);
    }
  }, [selectedShop, isRush]);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [, setUploadingProof] = useState(false);

  // Submission state & Result
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Default customer coordinates in Naval, Biliran
  const [customerLat] = useState(11.56437);
  const [customerLng] = useState(124.39964);

  // 1. Fetch fallback or ranked shops if none selected or for Change Shop modal
  useEffect(() => {
    let isMounted = true;
    const loadShops = async () => {
      setLoadingShops(true);
      try {
        const [recRes, allRes] = await Promise.allSettled([
          recommendationAPI.getRankedShops({
            latitude: customerLat,
            longitude: customerLng,
            travelMode,
            limit: 8,
          }),
          shopAPI.getAll({ limit: 30 }),
        ]);

        if (isMounted) {
          const recList = recRes.status === 'fulfilled' ? (recRes.value.data?.ranked || recRes.value.data?.shops || recRes.value.data?.data?.ranked || []) : [];
          let allList = allRes.status === 'fulfilled' ? (allRes.value.data?.data?.shops || allRes.value.data?.shops || allRes.value.data || []) : [];
          if (!Array.isArray(allList)) allList = [];

          // Merge unique shops, prioritizing verified rates and rank info
          const map = new Map();
          allList.forEach((s) => {
            const id = (s.shopId || s._id)?.toString();
            if (id) map.set(id, s);
          });
          recList.forEach((s) => {
            const id = (s.shopId || s._id)?.toString();
            if (id) {
              const existing = map.get(id) || {};
              map.set(id, { ...existing, ...s, pricing: s.pricing || existing.pricing });
            }
          });
          const combined = Array.from(map.values());
          setAvailableShops(combined);

          // If no shop was passed in navigation state, auto-select the best match
          if (combined.length > 0) {
            const best = combined.find((s) => s.isRecommended && s.isOpen)
              || combined.find((s) => s.isOpen)
              || combined.find((s) => s.isRecommended)
              || combined[0];

            setSelectedShop((prev) => {
              if (!prev) return best;
              // If shop had missing pricing, merge with full pricing from shop directory
              const match = combined.find((s) => (s.shopId || s._id)?.toString() === (prev.shopId || prev._id)?.toString());
              if (match) {
                return {
                  ...match,
                  ...prev,
                  pricing: (prev.pricing && Object.keys(prev.pricing).length > 0) ? prev.pricing : match.pricing,
                  isOpen: match.isOpen !== undefined ? match.isOpen : prev.isOpen,
                  isWithinHours: match.isWithinHours !== undefined ? match.isWithinHours : prev.isWithinHours,
                  unavailableReason: match.unavailableReason || prev.unavailableReason,
                  operatingHours: match.operatingHours || prev.operatingHours,
                };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('Could not load shops:', err.message);
      } finally {
        if (isMounted) setLoadingShops(false);
      }
    };

    loadShops();
    return () => { isMounted = false; };
  }, [customerLat, customerLng, travelMode]);

  // Current active shop reference
  const shop = selectedShop;

  // Selected shop's saved GCash details. Ranked/recommended shop objects do not
  // include GCash fields, so load them from the shop record itself.
  const selectedShopId = (shop?.shopId || shop?._id)?.toString() || null;
  const [gcashDetails, setGcashDetails] = useState({ shopId: null, gcashNumber: '', gcashName: '', loading: false });

  useEffect(() => {
    if (!selectedShopId) {
      setGcashDetails({ shopId: null, gcashNumber: '', gcashName: '', loading: false });
      return undefined;
    }
    let isMounted = true;
    setGcashDetails({ shopId: selectedShopId, gcashNumber: '', gcashName: '', loading: true });
    shopAPI.getById(selectedShopId)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || {};
        setGcashDetails({
          shopId: selectedShopId,
          gcashNumber: (data.gcashNumber || '').trim(),
          gcashName: (data.gcashName || '').trim(),
          loading: false,
        });
      })
      .catch(() => {
        if (isMounted) setGcashDetails({ shopId: selectedShopId, gcashNumber: '', gcashName: '', loading: false });
      });
    return () => { isMounted = false; };
  }, [selectedShopId]);

  // 2. Client-side Page Detection Helper for instant count
  const detectDocumentPages = async (fileObj) => {
    if (!fileObj) {
      setDetectedPages(null);
      setSpecs((prev) => ({ ...prev, totalPages: null }));
      return null;
    }
    const ext = fileObj.name?.split('.').pop()?.toLowerCase() || '';

    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) {
      setSpecs((prev) => ({ ...prev, totalPages: 1 }));
      setDetectedPages(1);
      return 1;
    }

    setIsDetecting(true);
    try {
      if (ext === 'pdf') {
        const arrayBuffer = await fileObj.arrayBuffer();
        const text = new TextDecoder('latin1').decode(arrayBuffer);
        const matches = text.match(/\/Type\s*\/Page\b/g);
        if (matches && matches.length > 0) {
          const pCount = matches.length;
          setSpecs((prev) => ({ ...prev, totalPages: pCount }));
          setDetectedPages(pCount);
          return pCount;
        }
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch && parseInt(countMatch[1], 10) > 0) {
          const pCount = parseInt(countMatch[1], 10);
          setSpecs((prev) => ({ ...prev, totalPages: pCount }));
          setDetectedPages(pCount);
          return pCount;
        }
      }
    } catch {
      // Detection failure handled by backend verification or manual input
    } finally {
      setIsDetecting(false);
    }
    return null;
  };

  // Helper to calculate custom range page count
  const customPageCount = useMemo(() => {
    return parseCustomPageCount(customPageRange, specs.totalPages);
  }, [customPageRange, specs.totalPages]);

  // 3. Price Calculation (strictly matching backend queueOptimizer formula)
  const priceBreakdown = useMemo(() => {
    const hasDocument = Boolean(file || uploadedDoc);
    // If no document is selected or uploaded, there are no billable pages and no total cost!
    if (!hasDocument) {
      return {
        canCalculate: false,
        hasValidPageCount: false,
        totalCost: 0,
        pages: 0,
        copies: Number(specs.copies || 1),
        basePrintingCost: 0,
        rushFee: 0,
        bindingFee: 0,
        effectivePageCount: 0,
        pricePerPage: 0,
      };
    }

    return calculatePrintJobPrice(specs, shop?.pricing, isRush, {
      customPageCount,
      detectedPages,
      uploadedDocPageCount: uploadedDoc?.pageCount,
    });
  }, [shop, specs, isRush, customPageCount, detectedPages, uploadedDoc, file]);

  // 4. File Upload Handler
  const performUpload = async (fileToUpload, pageCount) => {
    if (!fileToUpload) return;
    setUploading(true);
    setIsAnalyzing(false);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('document', fileToUpload);
      if (pageCount && pageCount > 0) {
        formData.append('pageCount', pageCount);
      }

      const res = await documentAPI.upload(formData, (evt) => {
        if (evt.total && evt.total > 0) {
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(Math.min(pct, 100));
          if (pct >= 100) {
            setIsAnalyzing(true);
          }
        }
      });

      setUploadProgress(100);
      setIsAnalyzing(true);

      const docData = res.data?.data || res.data;
      setUploadedDoc(docData);

      const verifiedPages = Number(res.data?.pageCount || docData?.pageCount || pageCount);
      if (verifiedPages && verifiedPages > 0) {
        setSpecs((prev) => ({ ...prev, totalPages: verifiedPages }));
        setDetectedPages(verifiedPages);
        toast.success('Document uploaded and verified successfully!');
      } else {
        setSpecs((prev) => ({ ...prev, totalPages: null }));
        setDetectedPages(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed. Please check your connection and try again.';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleIncomingFile = async (f) => {
    if (!f) return;
    if (uploading || isDetecting || isAnalyzing) return; // Prevent duplicate uploads while processing
    setUploadError(null);

    const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'bmp'];
    const ext = f.name?.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const errMsg = 'Unsupported file format. Please upload PDF, Word document (.doc, .docx), or Image (.jpg, .png).';
      setUploadError(errMsg);
      toast.error(errMsg);
      handleRemoveFile();
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (f.size > MAX_FILE_SIZE) {
      const errMsg = 'File size exceeds the 10MB limit. Please upload a smaller file.';
      setUploadError(errMsg);
      toast.error(errMsg);
      handleRemoveFile();
      return;
    }

    setFile(f);
    setUploadedDoc(null);
    setSpecs((prev) => ({ ...prev, totalPages: null }));
    setDetectedPages(null);

    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext);

    if (isImage) {
      setSpecs((prev) => ({
        ...prev,
        serviceType: 'photo_print',
        paperSize: '4R',
        paperType: 'photo',
        colorMode: 'color',
        sided: 'single',
        binding: 'none',
        totalPages: 1,
      }));
      setDetectedPages(1);
      performUpload(f, 1);
    } else {
      setSpecs((prev) => ({
        ...prev,
        serviceType: prev.serviceType === 'photo_print' ? 'doc_print' : (prev.serviceType || 'doc_print'),
        paperSize: ['4R', '3R', '5R'].includes(prev.paperSize) ? 'A4' : prev.paperSize,
        paperType: ['photo', 'glossy', 'matte'].includes(prev.paperType) ? 'bond' : prev.paperType,
      }));
      const pages = await detectDocumentPages(f);
      performUpload(f, pages);
    }
  };

  const handleRetryUpload = () => {
    if (!file) return;
    setUploadError(null);
    handleIncomingFile(file);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadedDoc(null);
    setUploadProgress(0);
    setUploadError(null);
    setDetectedPages(null);
    setIsAnalyzing(false);
    setSpecs((prev) => ({ ...prev, totalPages: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Payment proof handler
  const handlePaymentProofChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please upload an image receipt (JPG, PNG, or WEBP).');
      return;
    }

    setPaymentProofFile(selectedFile);
    setPaymentProofPreview(URL.createObjectURL(selectedFile));
    setUploadingProof(true);

    try {
      const formData = new FormData();
      formData.append('proof', selectedFile);
      const res = await requestAPI.uploadPaymentProof(formData);
      if (res.data?.proofUrl) {
        setPaymentProofUrl(res.data.proofUrl);
        toast.success('Payment receipt attached!');
      }
    } catch {
      toast.error('Could not upload receipt image. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  // 5. Final Order Submission Handler
  const handleFinalSubmit = async () => {
    if (!file && !uploadedDoc) {
      return toast.error('Please upload your document file before submitting.');
    }
    if (!shop) {
      return toast.error('Please select a printing shop.');
    }
    // Purely online, prepaid: GCash receipt is required before an order can be placed
    if (!paymentProofUrl && !paymentProofFile) {
      return toast.error('Please attach your GCash payment receipt screenshot.');
    }

    setSubmitting(true);
    try {
      let doc = uploadedDoc;
      if (!doc && file) {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('pageCount', priceBreakdown.pages);
        const upRes = await documentAPI.upload(formData);
        doc = upRes.data;
        setUploadedDoc(doc);
      }

      let finalProofUrl = paymentProofUrl;
      if (paymentProofFile && !finalProofUrl) {
        const formData = new FormData();
        formData.append('proof', paymentProofFile);
        const upRes = await requestAPI.uploadPaymentProof(formData);
        finalProofUrl = upRes.data?.proofUrl || '';
      }
      if (!finalProofUrl) {
        toast.error('Could not upload your GCash receipt. Please try again.');
        return;
      }

      const res = await requestAPI.submit({
        shopId: shop.shopId || shop._id,
        documentId: doc._id,
        printingSpecs: {
          serviceType: specs.serviceType,
          paperSize: specs.paperSize,
          paperType: specs.paperType,
          colorMode: specs.colorMode,
          copies: Number(specs.copies || 1),
          totalPages: Number(priceBreakdown.pages || 1),
          sided: specs.sided,
          pageRange: specs.pageRange === 'custom' ? customPageRange : 'all',
          binding: specs.binding,
          coverColor: specs.coverColor,
          additionalInstructions: specs.additionalInstructions || '',
        },
        isRush: Boolean(isRush && shop?.pricing?.allowRush !== false),
        travelMode: travelMode || 'motor',
        customerLat,
        customerLng,
        paymentMethod: 'gcash',
        paymentRefNumber: 'GCash Receipt Attached',
        paymentProofUrl: finalProofUrl,
      });

      const orderData = res.data?.data || res.data;
      setCreatedOrder(orderData);
      setActiveStep(4);
      toast.success('Print job submitted successfully!');
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Back to Dashboard navigation with unsaved work confirmation
  const handleBackToDashboard = useCallback(() => {
    // If order was already submitted (Step 4), simply go back to dashboard without warning
    if (activeStep === 4) {
      navigate('/dashboard');
      return;
    }

    // Check if there is an unsaved document or configured preferences
    const hasUnsavedWork = Boolean(file || uploadedDoc || activeStep > 1);

    if (hasUnsavedWork) {
      setShowLeaveModal(true);
    } else {
      navigate('/dashboard');
    }
  }, [file, uploadedDoc, activeStep, navigate]);

  return (
    <div className="w-full flex flex-col gap-5 pb-16 font-outfit fade-in">

      {/* ==================================================
          1. TOP NAVIGATION
      ================================================== */}
      <div>
        <button
          type="button"
          onClick={handleBackToDashboard}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all shadow-theme-xs cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* ==================================================
          2. 4-STEP WORKFLOW PROGRESS INDICATOR
             (Desktop horizontal progress bar, Mobile compact pill)
      ================================================== */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 sm:p-4 shadow-theme-xs">
        {/* Desktop Stepper */}
        <div className="hidden sm:flex items-center justify-between gap-2">
          {WORKFLOW_STEPS.map((s, idx) => {
            const isCompleted = activeStep > s.id;
            const isCurrent = activeStep === s.id;
            const canNavigate = s.id < activeStep && activeStep !== 4;

            return (
              <div key={s.id} className="flex-1 flex items-center">
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => canNavigate && setActiveStep(s.id)}
                  className={`flex items-center gap-2.5 text-left border-none bg-transparent ${
                    canNavigate ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-brand-600 text-white ring-4 ring-brand-500/20 shadow-2xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check size={14} strokeWidth={3} /> : s.id}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`text-xs font-bold block truncate ${
                        isCurrent
                          ? 'text-brand-600 dark:text-brand-400 font-extrabold'
                          : isCompleted
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {s.title}
                    </span>
                  </div>
                </button>

                {/* Connector Line between steps */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 sm:mx-4 transition-colors ${
                      activeStep > s.id
                        ? 'bg-emerald-500'
                        : activeStep === s.id
                        ? 'bg-brand-500/40'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Stepper: Compact Step indicator */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-brand-600 dark:text-brand-400">
              Step {activeStep} of 4: {WORKFLOW_STEPS[activeStep - 1]?.title}
            </span>
            <span className="text-gray-400">
              {Math.round((activeStep / 4) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-300 rounded-full"
              style={{ width: `${(activeStep / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ==================================================
          3. SELECTED SHOP SUMMARY BAR (Compact Top Card)
      ================================================== */}
      {shop && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 sm:p-4 shadow-theme-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Shop Avatar & Details */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
              <ShopFacadeImage
                src={shop.storefrontPhotoUrl}
                shopName={shop.shopName}
                className="w-full h-full"
                textClassName="text-xs font-bold"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                  Verified Shop
                </span>
                {shop.isOpen === false ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Clock size={11} />
                    <span>Closed</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    <span>Open Now</span>
                  </span>
                )}
                {shop.operationalCondition && shop.operationalCondition !== 'normal' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>
                      {shop.operationalCondition === 'high_walkin'
                        ? 'High Counter Demand'
                        : shop.operationalCondition === 'equipment_problem'
                        ? 'Equipment Maintenance'
                        : shop.operationalCondition === 'power_interruption'
                        ? 'Power Interruption'
                        : 'Service Delay'}
                    </span>
                    {Number(shop.operationalDelayMinutes) > 0 && (
                      <span>(+{shop.operationalDelayMinutes}m)</span>
                    )}
                  </span>
                )}
                <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white m-0 truncate">
                  {shop.shopName || 'Printing Shop'}
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 m-0 mt-0.5 flex items-center gap-1 truncate">
                <MapPin size={12} className="text-gray-400 shrink-0" />
                <span className="truncate">{shop.address || 'Naval, Biliran'}</span>
              </p>
              {/* Rating count indicator */}
              <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {shop.reviewsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span>{Number(shop.rating || 5).toFixed(1)}</span>
                    <span className="text-gray-400 font-normal">({shop.reviewsCount} reviews)</span>
                  </span>
                ) : (
                  <span className="text-gray-400">No ratings yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Change Shop button */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Car size={14} className="text-brand-500" />
                <span>~{shop.travelTimeMinutes || 2} min</span>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <Clock size={14} className="text-brand-500" />
                <span>Queue: {shop.queueCount || 0} jobs</span>
              </span>
            </div>

            {/* Change Shop Action */}
            <button
              type="button"
              onClick={() => setShowShopModal(true)}
              className="h-8 px-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-brand-600 dark:text-brand-400 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeftRight size={13} />
              <span>Change Shop</span>
            </button>
          </div>
        </div>
      )}

      {/* Pre-submission Operational Warning Banner */}
      {shop && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3 shadow-2xs">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-bold flex items-center gap-2 flex-wrap">
              <span>
                Operational Notice: {shop.operationalCondition === 'high_walkin'
                  ? 'High In-Store Counter Traffic'
                  : shop.operationalCondition === 'equipment_problem'
                  ? 'Printer Equipment Maintenance'
                  : shop.operationalCondition === 'power_interruption'
                  ? 'Power Outage / Brownout'
                  : 'Active Service Delay'}
              </span>
              {Number(shop.operationalDelayMinutes) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-100 text-[10px] font-extrabold">
                  +{shop.operationalDelayMinutes} min turnaround delay
                </span>
              )}
            </div>
            {shop.operationalMessage && (
              <p className="mt-1 italic text-amber-900/90 dark:text-amber-300 m-0">
                &ldquo;{shop.operationalMessage}&rdquo;
              </p>
            )}
            <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 m-0">
              You can still submit your online print request. Jobs are processed in the order received.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================
          4. MAIN WORKFLOW CONTAINER
             (Desktop: 2-Column with Active Step on Left & Sticky Summary on Right)
      ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">

        {/* --------------------------------------------------
            LEFT COLUMN (Active Step Form - 2 Cols on Desktop)
        --------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-5">

          {/* ==================================================
              STEP 1: UPLOAD DOCUMENT
          ================================================== */}
          {activeStep === 1 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-theme-xs space-y-5">
              {/* Step Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
                    Upload Your Document
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                  </p>
                </div>
              </div>

              {/* Dashed Drag & Drop Box */}
              {!file && !isProcessing && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isProcessing) return;
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleIncomingFile(dropped);
                  }}
                  className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 p-8 sm:p-12 text-center flex flex-col items-center justify-center transition-all hover:border-brand-500 hover:bg-brand-50/20"
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3.5 shadow-2xs">
                    <Upload size={24} strokeWidth={2} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white m-0">
                    Drag and drop your file here
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                    or click the button below to browse from your device
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    disabled={isProcessing}
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (selected) handleIncomingFile(selected);
                    }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-theme-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FileText size={15} />
                    <span>Browse Files</span>
                  </button>

                  <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 block">
                    PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                  </span>
                </div>
              )}

              {/* Upload & Analysis Progress Indicator - shown ONLY while upload or analysis is actively running */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2.5">
                  {uploadProgress < 100 && !isAnalyzing ? (
                    <>
                      <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300">
                        <span className="flex items-center gap-2">
                          <Upload size={14} className="animate-bounce text-brand-600 shrink-0" />
                          <span>Uploading document...</span>
                        </span>
                        <span className="tabular-nums font-mono">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
                        <div
                          className="h-full bg-brand-600 transition-all duration-150 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 m-0 truncate">
                        {file?.name} ({formatFileSize(file?.size)})
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                        <RefreshCw size={15} className="animate-spin text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200 block">
                          Analyzing document...
                        </span>
                        <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80 truncate block">
                          Verifying page count and print specifications
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Error Banner with Retry Action */}
              {uploadError && !isProcessing && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={15} className="shrink-0 text-rose-500" />
                    <span className="break-words">{uploadError}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {file && (
                      <button
                        type="button"
                        onClick={handleRetryUpload}
                        className="text-xs font-bold text-rose-700 dark:text-rose-400 underline cursor-pointer bg-transparent border-none inline-flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer bg-transparent border-none"
                    >
                      Choose another
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Uploaded File Summary - shown ONLY after successful processing */}
              {file && !isProcessing && !uploadError && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                    Uploaded File
                  </span>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-200 dark:border-brand-800">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white block truncate">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {formatFileSize(file.size)} • {specs.totalPages ? `${specs.totalPages} ${specs.totalPages === 1 ? 'page' : 'pages'}` : 'Page count needed'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {specs.totalPages ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={3} />
                          <span>Ready</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 inline-flex items-center gap-1">
                          <span>Page count needed</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        aria-label="Remove uploaded file"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer bg-transparent border-none"
                        title="Remove file"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Manual page count fallback if auto-detection failed */}
                  {!specs.totalPages && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle size={15} className="shrink-0 text-amber-500" />
                        <span>Page count could not be detected automatically.</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>Total pages:</span>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          placeholder="e.g. 1"
                          value={specs.totalPages || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setSpecs((prev) => ({ ...prev, totalPages: val > 0 ? val : null }));
                            setDetectedPages(val > 0 ? val : null);
                          }}
                          className="w-20 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 font-bold text-xs text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 1 Actions */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!file || isProcessing || !specs.totalPages || Boolean(uploadError)}
                  onClick={() => setActiveStep(2)}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-theme-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue to Preferences</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              STEP 2: PRINTING PREFERENCES
          ================================================== */}
          {activeStep === 2 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-theme-xs space-y-6">
              {/* Step Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
                    Printing Preferences
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                    Choose color mode, paper size, page range, and finishing options.
                  </p>
                </div>
              </div>

              {/* Informational Closed Shop Notice in Step 2 */}
              {shop && shop.isOpen === false && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                  <Clock size={16} className="text-amber-500 shrink-0" />
                  <span>
                    This shop is currently closed. You can still submit your print order, and the shop owner can review it when they are available.
                  </span>
                </div>
              )}

              {/* 1. Color Mode */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Color Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSpecs((prev) => ({ ...prev, colorMode: 'black_and_white' }))}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      specs.colorMode === 'black_and_white'
                        ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20 shadow-2xs'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs sm:text-sm block">Black & White</span>
                      <span className="text-[11px] text-gray-400 font-normal">₱{shop?.pricing?.bwPerPage || 2}.00 / page</span>
                    </div>
                    {specs.colorMode === 'black_and_white' && <CheckCircle2 size={16} className="text-brand-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpecs((prev) => ({ ...prev, colorMode: 'color' }))}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      specs.colorMode === 'color'
                        ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20 shadow-2xs'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs sm:text-sm block">Full Color</span>
                      <span className="text-[11px] text-gray-400 font-normal">₱{shop?.pricing?.colorPerPage || 4}.00 / page</span>
                    </div>
                    {specs.colorMode === 'color' && <CheckCircle2 size={16} className="text-brand-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* 2. Paper Size & Copies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Paper Size */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Paper Size
                  </label>
                  <select
                    value={specs.paperSize}
                    onChange={(e) => setSpecs((prev) => ({ ...prev, paperSize: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="A4">A4 (8.27 × 11.69 in)</option>
                    <option value="Letter">Short / Letter (8.5 × 11 in)</option>
                    <option value="Legal">Long / Legal (8.5 × 13 in)</option>
                    <option value="4R">4R Photo (4 × 6 in)</option>
                    <option value="A3">A3 (11.7 × 16.5 in)</option>
                  </select>
                </div>

                {/* Copies Counter */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Number of Copies
                  </label>
                  <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, copies: Math.max(1, (prev.copies || 1) - 1) }))}
                      className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-black cursor-pointer bg-transparent border-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={specs.copies || 1}
                      onChange={(e) => setSpecs((prev) => ({ ...prev, copies: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="flex-1 text-center py-2 bg-transparent text-gray-900 dark:text-white font-bold text-xs sm:text-sm focus:outline-none border-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, copies: (prev.copies || 1) + 1 }))}
                      className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-black cursor-pointer bg-transparent border-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Page Range & Sidedness */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Page Range */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Page Range
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, pageRange: 'all' }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        specs.pageRange === 'all'
                          ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      All Pages ({specs.totalPages || '—'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, pageRange: 'custom' }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        specs.pageRange === 'custom'
                          ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {specs.pageRange === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. 1-5, 8"
                      value={customPageRange}
                      onChange={(e) => setCustomPageRange(e.target.value)}
                      className="w-full mt-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Sidedness */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Print Sides
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, sided: 'single' }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        specs.sided === 'single'
                          ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      Single-sided
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => ({ ...prev, sided: 'double' }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        specs.sided === 'double'
                          ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      Back-to-back
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Binding & Rush Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Binding Option
                  </label>
                  <select
                    value={specs.binding}
                    onChange={(e) => setSpecs((prev) => ({ ...prev, binding: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="none">No Binding (Loose)</option>
                    <option value="staple">Stapled / Fastener (+₱{Number(shop?.pricing?.stapleCost ?? 5).toFixed(2)})</option>
                    <option value="spiral">Spiral Ring Binding (+₱{Number(shop?.pricing?.bindingCost ?? 35).toFixed(2)})</option>
                    <option value="soft_bound">Soft Bound Book (+₱{Number(shop?.pricing?.softbindCost ?? 50).toFixed(2)})</option>
                  </select>
                </div>

                {/* Rush Order Toggle */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Order Priority
                  </label>
                  {shop?.pricing && shop.pricing.allowRush === false ? (
                    <div className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-medium flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-gray-400" />
                        <span className="font-semibold text-gray-600 dark:text-gray-300">Rush Order</span>
                      </div>
                      <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                        Rush orders are not accepted by this shop
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRush(!isRush)}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        isRush
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 shadow-2xs'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Zap size={14} className={isRush ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} />
                        <span>Rush Order (+₱{Number(shop?.pricing?.rushFee ?? 20).toFixed(2)})</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {isRush ? 'Priority Queue' : 'Standard'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* 5. Special Instructions */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Special Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={specs.additionalInstructions}
                  onChange={(e) => setSpecs((prev) => ({ ...prev, additionalInstructions: e.target.value }))}
                  placeholder="e.g. Please staple top-left corner, punch holes, or handle with care..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* Step 2 Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="h-10 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-all shadow-theme-xs cursor-pointer"
                >
                  <span>Continue to Review</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              STEP 3: REVIEW & CONFIRM
          ================================================== */}
          {activeStep === 3 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-theme-xs space-y-6">
              {/* Step Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
                    Review & Confirm Order
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                    Verify your order summary and choose payment method.
                  </p>
                </div>
              </div>

              {/* Summary Review Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Document & Specs Summary */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Print Specifications
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer bg-transparent border-none"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                    <div className="font-bold text-gray-900 dark:text-white truncate">
                      {file?.name || 'Document.pdf'}
                    </div>
                    <div>
                      Mode: <span className="font-bold">{specs.colorMode === 'color' ? 'Full Color' : 'Black & White'}</span>
                    </div>
                    <div>
                      Paper: <span className="font-bold">{specs.paperSize}</span> • Sided: <span className="font-bold">{specs.sided === 'double' ? 'Double' : 'Single'}</span>
                    </div>
                    <div>
                      Pages: <span className="font-bold">{priceBreakdown.pages}</span> × <span className="font-bold">{specs.copies || 1} copy</span>
                    </div>
                    {specs.binding !== 'none' && (
                      <div>
                        Binding: <span className="font-bold capitalize">{specs.binding.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Shop Review */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Printing Shop
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowShopModal(true)}
                      className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer bg-transparent border-none"
                    >
                      Change
                    </button>
                  </div>
                  <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                    <div className="font-bold text-gray-900 dark:text-white truncate">
                      {shop?.shopName}
                    </div>
                    <div className="text-gray-500 truncate">
                      {shop?.address}
                    </div>
                    <div className="pt-1 text-[11px] text-gray-400">
                      Estimated travel: ~{shop?.travelTimeMinutes || 2} mins
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Payment Method
                </label>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('gcash')}
                  className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between border-brand-600 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20 shadow-2xs w-full"
                >
                  <div>
                    <span className="font-bold text-xs sm:text-sm block">GCash E-Wallet</span>
                    <span className="text-[11px] text-gray-400 font-normal">Fast direct payment</span>
                  </div>
                  <CheckCircle2 size={16} className="text-brand-600 shrink-0" />
                </button>

                {/* GCash Details & Proof Upload */}
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">GCash Account Name:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{gcashDetails.gcashName || shop?.shopName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 dark:text-gray-400 block">GCash Number:</span>
                      <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                        {gcashDetails.loading ? 'Loading…' : (gcashDetails.gcashNumber || 'Not provided')}
                      </span>
                    </div>
                  </div>

                  {/* Receipt Upload Field */}
                  <div className="space-y-1.5 pt-2 border-t border-blue-200/60 dark:border-blue-900/60">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Upload GCash Payment Screenshot
                    </label>
                    <input
                      type="file"
                      ref={proofInputRef}
                      accept="image/*"
                      onChange={handlePaymentProofChange}
                      className="hidden"
                    />
                    {paymentProofPreview ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Check size={14} /> Receipt Attached
                        </span>
                        <button
                          type="button"
                          onClick={() => { setPaymentProofFile(null); setPaymentProofPreview(''); setPaymentProofUrl(''); }}
                          className="text-rose-600 hover:underline cursor-pointer bg-transparent border-none text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => proofInputRef.current?.click()}
                        className="w-full py-2.5 rounded-xl border border-dashed border-brand-300 dark:border-brand-700 bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-brand-50"
                      >
                        <CreditCard size={14} />
                        <span>Attach Payment Receipt</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Closed Shop Notification in Step 3 */}
              {shop && shop.isOpen === false && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                  <Clock size={16} className="text-amber-500 shrink-0" />
                  <span>
                    This shop is currently closed ({shop.unavailableReason || 'outside regular operating hours'}). You can still submit your print order now — the shop owner will review and process it when they reopen.
                  </span>
                </div>
              )}

              {/* Step 3 Actions */}
              <div className="pt-3 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Preferences</span>
                </button>

                <button
                  type="button"
                  disabled={submitting || !priceBreakdown.hasValidPageCount}
                  onClick={handleFinalSubmit}
                  className="h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-theme-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Submitting Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Submit Order (₱{priceBreakdown.totalCost.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              STEP 4: TRACK REQUEST (Success Confirmation Screen)
          ================================================== */}
          {activeStep === 4 && createdOrder && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-theme-xs text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={36} strokeWidth={2.4} />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white m-0 tracking-tight">
                  Print Job Submitted Successfully!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
                  Your order has been queued at <strong className="text-gray-800 dark:text-gray-200">{shop?.shopName}</strong>. Please present your claim code when collecting your documents.
                </p>
                {shop && shop.isOpen === false && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto text-center flex items-center justify-center gap-2">
                    <Clock size={16} className="text-amber-500 shrink-0" />
                    <span>
                      This shop is currently closed. Your order has been placed, and the shop owner will review and process it when they are available.
                    </span>
                  </div>
                )}
              </div>

              {/* Order Claim Code Card */}
              <div className="max-w-sm mx-auto p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                  Your Claim Code
                </span>
                <div className="font-mono font-black text-2xl text-brand-600 dark:text-brand-400 tracking-wider">
                  {createdOrder.claimCode || `#PD-${createdOrder._id?.slice(-4).toUpperCase()}`}
                </div>
              </div>

              {/* Primary Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => navigate(`/my-requests/${createdOrder._id}`)}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-theme-xs transition-colors cursor-pointer"
                >
                  <Clock size={16} />
                  <span>Track Order Live</span>
                </button>
                <Link
                  to="/my-requests"
                  className="w-full sm:w-auto h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-theme-xs transition-colors no-underline"
                >
                  <span>View All Orders</span>
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-theme-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>Dashboard</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* --------------------------------------------------
            RIGHT COLUMN (Order Summary Sticky Sidebar - 1 Col)
        --------------------------------------------------- */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-theme-xs space-y-4 lg:sticky lg:top-4">
            {/* Order Summary Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <Printer size={16} className="text-brand-600" />
                <span>Order Summary</span>
              </span>
            </div>

            {/* Shop Mini Card */}
            {shop ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                  {shop.storefrontPhotoUrl ? (
                    <img src={shop.storefrontPhotoUrl} alt={shop.shopName} className="w-full h-full object-cover" />
                  ) : (
                    <Store size={18} className="text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                      {shop.shopName}
                    </span>
                    {shop.isOpen === false && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                        Closed
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 truncate block">
                    {shop.address || 'Naval, Biliran'}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowShopModal(true)}
                className="w-full p-2.5 rounded-xl border border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-50/50 flex items-center justify-center gap-1.5 cursor-pointer bg-transparent"
              >
                <Store size={14} />
                <span>Select a Printing Shop</span>
              </button>
            )}

            {/* Print Details Breakdown */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              <span className="font-bold text-[11px] text-gray-400 uppercase tracking-wider block">
                Print Details
              </span>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Document:</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
                  {file?.name || uploadedDoc?.originalName || 'No file selected'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Print Type:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {specs.colorMode === 'color' ? 'Full Color' : 'Black & White'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Paper Size:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{specs.paperSize}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Copies:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {specs.copies || 1} {Number(specs.copies) === 1 ? 'copy' : 'copies'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Page Range:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPageRangeSummary(
                    (file || uploadedDoc) ? specs : { ...specs, totalPages: null },
                    customPageCount,
                    customPageRange,
                    (file || uploadedDoc) ? (detectedPages ?? uploadedDoc?.pageCount) : null
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Sides:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {specs.sided === 'double' ? 'Double-sided' : 'Single-sided'}
                </span>
              </div>
              {specs.binding !== 'none' && (
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                  <span>Binding:</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">
                    {specs.binding === 'soft_bound' ? 'Soft Bound Book' : specs.binding === 'spiral' ? 'Spiral Ring Binding' : specs.binding === 'staple' ? 'Stapled / Fastener' : specs.binding}
                  </span>
                </div>
              )}
              {isRush && shop?.pricing?.allowRush !== false && (
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1 font-medium"><Zap size={12} className="fill-amber-500 text-amber-500" /> Rush Priority:</span>
                  <span className="font-bold">+₱{Number(shop?.pricing?.rushFee ?? 20).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Total Price Section */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                Total
              </span>
              <div className={`text-2xl sm:text-3xl font-black leading-tight ${priceBreakdown.hasValidPageCount ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {priceBreakdown.hasValidPageCount ? (
                  `₱${priceBreakdown.totalCost.toFixed(2)}`
                ) : (
                  <span>—</span>
                )}
              </div>
              {!priceBreakdown.hasValidPageCount && (
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {loadingShops
                    ? 'Calculating total...'
                    : isProcessing
                    ? 'Analyzing document...'
                    : !file && !uploadedDoc
                    ? 'Upload document to calculate total'
                    : 'Page count needed'}
                </div>
              )}
              {shop && shop.isOpen === false && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 pt-1 leading-snug flex items-start gap-1">
                  <Clock size={13} className="shrink-0 mt-0.5" />
                  <span>
                    This shop is currently closed. You can still submit your print order, and the shop owner can review it when they are available.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ==================================================
          5. CHANGE PRINTING SHOP MODAL
      ================================================== */}
      {showShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white m-0">
                  Select a Printing Shop
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 m-0">
                  Switch store without losing your uploaded file or settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShopModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer bg-transparent border-none"
              >
                <X size={18} />
              </button>
            </div>

            {/* Shop Search Input */}
            <input
              type="text"
              placeholder="Search by shop name or location..."
              value={shopSearchQuery}
              onChange={(e) => setShopSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white shrink-0"
            />

            {/* Shops List */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {loadingShops ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading shops...</div>
              ) : availableShops.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No print shops available.</div>
              ) : (
                availableShops
                  .filter((s) => {
                    if (!shopSearchQuery.trim()) return true;
                    const q = shopSearchQuery.toLowerCase();
                    return (s.shopName || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q);
                  })
                  .map((s) => {
                    const isSelected = (s.shopId || s._id) === (shop?.shopId || shop?._id);
                    return (
                      <div
                        key={s.shopId || s._id}
                        onClick={() => {
                          setSelectedShop(s);
                          setShowShopModal(false);
                          toast.success(`Switched to ${s.shopName}`);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20'
                            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {s.storefrontPhotoUrl ? (
                              <img src={s.storefrontPhotoUrl} alt={s.shopName} className="w-full h-full object-cover" />
                            ) : (
                              <Store size={18} className="text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-gray-900 dark:text-white block truncate">
                                {s.shopName}
                              </span>
                              {s.isOpen === false ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                  Closed
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                  Open
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 truncate block">
                              {s.address}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-brand-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          6. LEAVE PAGE CONFIRMATION MODAL
      ================================================== */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={() => {
          setShowLeaveModal(false);
          navigate('/dashboard');
        }}
        title="Leave Print Job Setup?"
        description="You have an uploaded document and unsaved printing settings. If you leave now, your current progress will not be saved."
        confirmLabel="Leave to Dashboard"
        cancelLabel="Stay Here"
        danger={false}
        icon="warning"
      />

    </div>
  );
}
