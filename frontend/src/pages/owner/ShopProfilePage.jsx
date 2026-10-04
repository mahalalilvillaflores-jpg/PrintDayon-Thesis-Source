import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { shopAPI } from '../../services/api';
import {
  Store, Camera, MapPin, Phone, CreditCard, Save,
  AlertCircle, CheckCircle2, Upload, ExternalLink,
  Sparkles, Navigation, Layers, Clock, ShieldCheck, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import ShopFacadeImage, { StorefrontPlaceholder } from '../../components/common/ShopFacadeImage';
import ShopLocationSection from '../../components/owner/ShopLocationSection';

const NAVAL_LANDMARKS = [
  { name: 'BiPSU Main Campus (Vicentillo Ext.)', lat: 11.563591, lng: 124.398505 },
  { name: 'Naval Town Plaza & Cathedral', lat: 11.562502, lng: 124.395952 },
  { name: 'Naval Public Market / Terminal', lat: 11.560478, lng: 124.396483 },
  { name: 'Naval Port / Pier Area', lat: 11.5615, lng: 124.3935 },
  { name: 'Sitio Butay, P.I. Garcia', lat: 11.56437, lng: 124.39964 },
];

export default function ShopProfilePage() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const [form, setForm] = useState({
    shopName: '',
    description: '',
    address: '',
    landmark: '',
    locationDescription: '',
    latitude: 11.5628,
    longitude: 124.3980,
    contactNumber: '',
    gcashName: '',
    gcashNumber: '',
    storefrontPhotoUrl: '',
  });

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      const shopData = res.data;
      setShop(shopData);

      setForm({
        shopName: shopData.shopName || '',
        description: shopData.description || '',
        address: shopData.address || '',
        landmark: shopData.landmark || '',
        locationDescription: shopData.locationDescription || '',
        latitude: shopData.latitude || shopData.location?.coordinates?.[1] || 11.5628,
        longitude: shopData.longitude || shopData.location?.coordinates?.[0] || 124.3980,
        contactNumber: shopData.contactNumber || '',
        gcashName: shopData.gcashName || '',
        gcashNumber: shopData.gcashNumber || '',
        storefrontPhotoUrl: shopData.storefrontPhotoUrl || '',
      });
    } catch (err) {
      toast.error('Could not load shop profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG or PNG)');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await shopAPI.uploadStorefrontPhoto(formData);
      const newUrl = res.data?.storefrontPhotoUrl || res.data?.shop?.storefrontPhotoUrl;

      setForm((prev) => ({
        ...prev,
        storefrontPhotoUrl: newUrl || prev.storefrontPhotoUrl,
      }));

      toast.success('Storefront facade photo updated successfully!');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    setDeletingPhoto(true);
    try {
      await shopAPI.deleteStorefrontPhoto();
      setForm((prev) => ({
        ...prev,
        storefrontPhotoUrl: '',
      }));
      toast.success('Facade photo deleted successfully.');
      setShowDeleteModal(false);
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete facade photo');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleLandmarkSelect = (lm) => {
    setForm((prev) => ({
      ...prev,
      landmark: lm.name,
      latitude: lm.lat,
      longitude: lm.lng,
    }));
    toast.success(`Coordinates aligned to ${lm.name}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shop?._id) return;

    if (!form.shopName.trim()) {
      toast.error('Shop name is required');
      return;
    }
    if (!form.address.trim()) {
      toast.error('Physical address is required');
      return;
    }

    setSaving(true);
    try {
      await shopAPI.update(shop._id, {
        shopName: form.shopName.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        locationDescription: form.locationDescription.trim(),
        latitude: parseFloat(form.latitude) || 11.5628,
        longitude: parseFloat(form.longitude) || 124.3980,
        contactNumber: form.contactNumber.trim(),
        gcashName: form.gcashName.trim(),
        gcashNumber: form.gcashNumber.trim(),
      });

      toast.success('Shop profile updated successfully!');
      fetchShop();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update shop profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading shop profile...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#465FFF] dark:text-sky-400">
            <Store size={20} />
          </span>
          <h1 className="text-xl font-black text-[#101828] dark:text-white m-0">
            Shop Profile &amp; Storefront Identity
          </h1>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-bold text-sm shadow-md transition-all cursor-pointer border-none disabled:opacity-50 shrink-0"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Quick Links to Sister Management Pages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/owner/services"
          className="p-3 rounded-xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-2xs hover:border-[#465FFF] transition-all no-underline flex items-center gap-2.5"
        >
          <Layers size={16} className="text-[#465FFF]" />
          <div>
            <div className="text-xs font-bold text-[#101828] dark:text-white">Services</div>
            <div className="text-[10px] text-slate-400">Rates &amp; pricing</div>
          </div>
        </Link>
        <Link
          to="/owner/schedule"
          className="p-3 rounded-xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-2xs hover:border-[#465FFF] transition-all no-underline flex items-center gap-2.5"
        >
          <Clock size={16} className="text-emerald-600" />
          <div>
            <div className="text-xs font-bold text-[#101828] dark:text-white">Schedule</div>
            <div className="text-[10px] text-slate-400">Weekly hours</div>
          </div>
        </Link>
        <Link
          to="/owner/operational-status"
          className="p-3 rounded-xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-2xs hover:border-[#465FFF] transition-all no-underline flex items-center gap-2.5"
        >
          <Sparkles size={16} className="text-amber-600" />
          <div>
            <div className="text-xs font-bold text-[#101828] dark:text-white">Overrides</div>
            <div className="text-[10px] text-slate-400">Delays &amp; closures</div>
          </div>
        </Link>
        <Link
          to="/owner/verification"
          className="p-3 rounded-xl bg-white dark:bg-[#101828] border border-[#E2E8F0] dark:border-slate-800 shadow-2xs hover:border-[#465FFF] transition-all no-underline flex items-center gap-2.5"
        >
          <ShieldCheck size={16} className="text-sky-600" />
          <div>
            <div className="text-xs font-bold text-[#101828] dark:text-white">Verification</div>
            <div className="text-[10px] text-slate-400">DTI &amp; Permits</div>
          </div>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Storefront / Facade Photo Section */}
        <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
            <Camera size={17} className="text-[#465FFF]" />
            Storefront Facade Photo (Public)
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            {/* Photo Preview */}
            <div className="w-full sm:w-64 h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center relative shadow-inner">
              <ShopFacadeImage
                src={form.storefrontPhotoUrl}
                shopName={form.shopName || shop?.shopName}
                className="w-full h-full"
              />
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold shadow-xs cursor-pointer transition-all">
                  <Upload size={14} />
                  {uploadingPhoto ? 'Uploading Photo...' : form.storefrontPhotoUrl ? 'Replace Facade Photo' : 'Upload Storefront Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto || deletingPhoto}
                    className="sr-only"
                  />
                </label>

                {form.storefrontPhotoUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={uploadingPhoto || deletingPhoto}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Delete Photo
                  </button>
                ) : null}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed m-0">
                Recommended: Horizontal orientation (16:9), under 5MB (JPG, PNG).<br />
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Important:</span> Do not upload government permits or personal IDs here. This photo is displayed directly to customers on search cards.
              </p>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 space-y-4 font-outfit animate-in fade-in zoom-in-95">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Delete facade photo?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 m-0">This photo will no longer be shown to customers.</p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingPhoto}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={deletingPhoto}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors border-none cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {deletingPhoto ? 'Deleting...' : 'Delete Photo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Basic Shop Identity */}
        <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">
            Shop Information &amp; Description
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Printing Shop Name *
              </label>
              <input
                type="text"
                value={form.shopName}
                onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
                placeholder="e.g. QuickPrint Studio Naval"
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Shop Tagline / Short Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Fast document printing, bookbinding, and thesis production near BiPSU campus."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Location & GPS Pinning */}
        <ShopLocationSection form={form} setForm={setForm} />

        {/* Contact & Payment Information */}
        <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
            <Phone size={16} className="text-emerald-500" />
            Contact &amp; Payment Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Cellphone Number (09xx)
              </label>
              <input
                type="tel"
                value={form.contactNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="09171234567"
                maxLength={11}
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                GCash Registered Name
              </label>
              <input
                type="text"
                value={form.gcashName}
                onChange={(e) => setForm((prev) => ({ ...prev, gcashName: e.target.value }))}
                placeholder="e.g. Maria S."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                GCash Mobile Number
              </label>
              <input
                type="tel"
                value={form.gcashNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, gcashNumber: e.target.value }))}
                placeholder="09XXXXXXXXX"
                maxLength={11}
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-black text-sm shadow-lg transition-all cursor-pointer border-none disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save All Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
