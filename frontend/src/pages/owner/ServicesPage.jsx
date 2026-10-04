import { useState, useEffect } from 'react';
import { shopAPI } from '../../services/api';
import {
  FileText, CheckCircle2, Zap, Plus, Trash2,
  AlertCircle, Save, HelpCircle, Layers, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_SERVICE_PRICING = {
  bwPerPage: 2,
  bwLongPerPage: 3,
  colorPerPage: 4,
  colorLongPerPage: 5,
  photocopyBwA4: 1.5,
  photocopyBwLong: 2,
  photocopyColor: 5,
  bindingCost: 35,
  softbindCost: 50,
  stapleCost: 5,
  speedPerPageSeconds: 5,
  allowRush: true,
  rushFee: 20,
};

const SERVICE_CATEGORIES = [
  {
    id: 'doc_print',
    title: 'Document Printing',
    desc: 'Standard paper printing for student papers, reports, and modules',
    items: [
      { key: 'bwPerPage', label: 'B&W — A4 / Short', unit: '₱ / page', hint: 'Default: ₱2.00' },
      { key: 'bwLongPerPage', label: 'B&W — Long / Legal', unit: '₱ / page', hint: 'Default: ₱3.00' },
      { key: 'colorPerPage', label: 'Color — A4 / Short', unit: '₱ / page', hint: 'Default: ₱4.00' },
      { key: 'colorLongPerPage', label: 'Color — Long / Legal', unit: '₱ / page', hint: 'Default: ₱5.00' },
    ],
  },
  {
    id: 'photocopy',
    title: 'Photocopy / Xerox',
    desc: 'Physical document reproduction & multi-page xerox',
    items: [
      { key: 'photocopyBwA4', label: 'B&W Photocopy (A4 / Short)', unit: '₱ / page', hint: 'Default: ₱1.50' },
      { key: 'photocopyBwLong', label: 'B&W Photocopy (Long / Legal)', unit: '₱ / page', hint: 'Default: ₱2.00' },
      { key: 'photocopyColor', label: 'Full Color Photocopy', unit: '₱ / page', hint: 'Default: ₱5.00' },
    ],
  },
  {
    id: 'bookbinding',
    title: 'Bookbinding & Finishing',
    desc: 'Spiral binding, softbind, stapling, and report covers',
    items: [
      { key: 'bindingCost', label: 'Spiral / Ring Binding', unit: '₱ / book', hint: 'Default: ₱35.00' },
      { key: 'softbindCost', label: 'Softbind / Thermal Cover', unit: '₱ / book', hint: 'Default: ₱50.00' },
      { key: 'stapleCost', label: 'Stapling / Fastener', unit: '₱ / copy', hint: 'Default: ₱5.00' },
    ],
  },
  {
    id: 'scanning',
    title: 'Document Scanning',
    desc: 'Digital document capture, PDF generation & OCR scanning',
    items: [],
  },
  {
    id: 'lamination',
    title: 'Lamination & ID Printing',
    desc: 'Plastic pouch lamination, ID badges, and bag tags',
    items: [],
  },
];

export default function ServicesPage() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pricing, setPricing] = useState(DEFAULT_SERVICE_PRICING);
  const [availableServices, setAvailableServices] = useState(['doc_print', 'photocopy', 'bookbinding']);
  const [customServices, setCustomServices] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomPrice, setNewCustomPrice] = useState('');

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    setLoading(true);
    try {
      const res = await shopAPI.getMyShop();
      const shopData = res.data;
      setShop(shopData);

      if (shopData.pricing) {
        setPricing({ ...DEFAULT_SERVICE_PRICING, ...shopData.pricing });
      }

      if (Array.isArray(shopData.services)) {
        const avail = [];
        const custom = [];
        shopData.services.forEach((s) => {
          const sName = typeof s === 'string' ? s : s?.name;
          if (!sName) return;

          const matched = SERVICE_CATEGORIES.find(
            (c) =>
              c.id === sName ||
              c.title.toLowerCase() === sName.toLowerCase() ||
              (c.id === 'doc_print' && /document\s*print/i.test(sName)) ||
              (c.id === 'photocopy' && /photocopy|xerox/i.test(sName)) ||
              (c.id === 'bookbinding' && /bookbinding|binding/i.test(sName)) ||
              (c.id === 'scanning' && /scan/i.test(sName)) ||
              (c.id === 'lamination' && /lamina/i.test(sName))
          );

          const isAvail = typeof s === 'string' ? true : s.available !== false;

          if (matched) {
            if (isAvail && !avail.includes(matched.id)) {
              avail.push(matched.id);
            }
          } else {
            custom.push({
              id: s._id || s.id || Math.random().toString(36).substring(2, 9),
              name: sName,
              description: s.description || '',
              price: Number(s.price) || 0,
              available: isAvail,
            });
          }
        });

        setAvailableServices(avail.length > 0 ? avail : ['doc_print', 'photocopy', 'bookbinding']);
        setCustomServices(custom);
      }
    } catch (err) {
      toast.error('Could not load service settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (key, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setPricing((prev) => ({ ...prev, [key]: num }));
  };

  const toggleService = (id) => {
    setAvailableServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!newCustomName.trim()) {
      toast.error('Please enter a service name');
      return;
    }
    const newService = {
      id: 'custom_' + Date.now(),
      name: newCustomName.trim(),
      description: '',
      price: Math.max(0, parseFloat(newCustomPrice) || 0),
      available: true,
    };
    setCustomServices((prev) => [...prev, newService]);
    setNewCustomName('');
    setNewCustomPrice('');
    toast.success('Custom service added');
  };

  const handleRemoveCustom = (id) => {
    setCustomServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleCustom = (id) => {
    setCustomServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, available: !s.available } : s))
    );
  };

  const handleSave = async () => {
    if (!shop?._id) return;
    setSaving(true);
    try {
      // Build final services array
      const standardServices = availableServices.map((id) => {
        const cat = SERVICE_CATEGORIES.find((c) => c.id === id);
        return {
          name: cat?.title || id,
          available: true,
        };
      });

      const finalServices = [
        ...standardServices,
        ...customServices.map((c) => ({
          name: c.name,
          description: c.description,
          price: c.price,
          available: c.available,
        })),
      ];

      await shopAPI.update(shop._id, {
        pricing,
        services: finalServices,
      });

      toast.success('Services & pricing updated successfully!');
      fetchShopData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-[#465FFF] border-t-transparent rounded-full animate-spin mr-3" />
        Loading service configuration...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Rush Order Policy */}
      <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600">
              <Zap size={18} />
            </span>
            <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">Rush Order Processing</h2>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={pricing.allowRush}
              onChange={(e) => setPricing((prev) => ({ ...prev, allowRush: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#465FFF]" />
          </label>
        </div>
        {pricing.allowRush && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Rush Service Fee:</span>
            <div className="relative w-32">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
              <input
                type="number"
                min="0"
                step="5"
                value={pricing.rushFee}
                onChange={(e) => handlePriceChange('rushFee', e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>
            <span className="text-xs text-slate-400">added per rush order</span>
          </div>
        )}
      </div>

      {/* Standard Service Categories */}
      <div className="space-y-4">
        {SERVICE_CATEGORIES.map((cat) => {
          const isEnabled = availableServices.includes(cat.id);
          return (
            <div
              key={cat.id}
              className={`bg-white dark:bg-[#101828] rounded-2xl border transition-all shadow-xs ${
                isEnabled
                  ? 'border-[#E2E8F0] dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800/60 opacity-75'
              }`}
            >
              {/* Category Header */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleService(cat.id)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                      isEnabled
                        ? 'bg-[#465FFF] border-[#465FFF] text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                  <h3 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
                    {cat.title}
                    {isEnabled ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        Disabled
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* Pricing Inputs */}
              {isEnabled && cat.items.length > 0 && (
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-b-2xl">
                  {cat.items.map((item) => (
                    <div key={item.key} className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                      <div className="flex justify-between items-center text-xs font-semibold text-[#101828] dark:text-slate-200 mb-1.5">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-slate-400">{item.unit}</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={pricing[item.key] ?? 0}
                          onChange={(e) => handlePriceChange(item.key, e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#465FFF]"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{item.hint}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Services */}
      <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0">Additional / Custom Services</h2>
        </div>

        {/* Existing Custom Services List */}
        {customServices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {customServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleCustom(service.id)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center border cursor-pointer ${
                      service.available
                        ? 'bg-[#465FFF] border-[#465FFF] text-white'
                        : 'bg-white dark:bg-slate-700 border-slate-300 text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <div>
                    <div className="text-xs font-bold text-[#101828] dark:text-white">{service.name}</div>
                    <div className="text-[11px] font-semibold text-[#465FFF] dark:text-sky-400">
                      ₱{Number(service.price).toFixed(2)} base
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCustom(service.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors bg-transparent border-none cursor-pointer"
                  title="Remove Service"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Custom Service Form */}
        <form onSubmit={handleAddCustom} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Service name (e.g. Sticker Paper Printing)"
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
          />
          <div className="relative w-full sm:w-36">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₱</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Base Price"
              value={newCustomPrice}
              onChange={(e) => setNewCustomPrice(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold border-none cursor-pointer transition-colors"
          >
            <Plus size={15} />
            Add Service
          </button>
        </form>
      </div>

      {/* Floating Save Button Bar */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-black text-sm shadow-lg transition-all cursor-pointer border-none disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Saving Settings...' : 'Save All Services & Pricing'}
        </button>
      </div>
    </div>
  );
}
