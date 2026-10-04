import React, { useState } from 'react';
import {
  ShieldCheck, Save, RefreshCw,
  MapPin, Globe, HardDrive, FileText,
  Sliders, Bell, FileCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const BLUE = '#465FFF';
const GRAY = '#64748B';

function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      onClick={onChange}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: '46px',
        height: '24px',
        borderRadius: '9999px',
        backgroundColor: checked ? BLUE : '#CBD5E1',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.18)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          transform: checked ? 'translateX(22px)' : 'translateX(0)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </button>
  );
}

export default function AdminSettingsPage() {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const [saving, setSaving] = useState(false);
  const [platformConfig, setPlatformConfig] = useState({
    platformName: 'PrintDayon Naval Printing Network',
    municipalRegion: 'Naval, Biliran (Region VIII)',
    supportEmail: 'support@printdayon.ph',
    maxUploadSizeMB: 25,
    allowedFormats: 'PDF, DOCX, DOC, JPG, JPEG, PNG',
    requireBothPermitAndDti: true,
    requireLocationPinpoint: true,
    enableRealtimeAlerts: true,
  });

  const handleToggle = (key) => {
    setPlatformConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Settings updated successfully.');
    }, 600);
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-12">
      {/* Streamlined Admin Identity Banner */}
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          border: '1px solid #E2E8F0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(6,63,92,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="w-12 h-12 rounded-xl bg-brand-500 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-theme-xs">
            {getInitials(user?.name)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                {user?.name || 'Administrator'}
              </h2>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  background: '#F5F3FF',
                  color: '#6D28D9',
                  border: '1px solid #DDD6FE',
                  letterSpacing: '0.02em',
                }}
              >
                SUPER ADMIN
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: GRAY, margin: '0.2rem 0 0' }}>
              {user?.email || 'admin@printdayon.ph'}
            </p>
          </div>
        </div>

        {/* Save Settings Action */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1.25rem',
            borderRadius: '0.625rem',
            background: BLUE,
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(70,95,255,0.22)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!saving) e.currentTarget.style.opacity = '0.92';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* General Settings Card */}
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(6,63,92,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              background: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sliders size={17} color={BLUE} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
            General Settings
          </h3>
        </div>

        {/* 2-Column Responsive Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {/* Field 1: Network Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Platform Name
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Globe size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
              <input
                type="text"
                value={platformConfig.platformName}
                onChange={(e) => setPlatformConfig({ ...platformConfig, platformName: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                  borderRadius: '0.625rem',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.8125rem',
                  color: NAVY,
                  background: '#F8FAFC',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.borderColor = BLUE;
                  e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.background = '#F8FAFC';
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Field 2: Municipal Jurisdiction */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Location / Municipality
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <MapPin size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
              <input
                type="text"
                value={platformConfig.municipalRegion}
                onChange={(e) => setPlatformConfig({ ...platformConfig, municipalRegion: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                  borderRadius: '0.625rem',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.8125rem',
                  color: NAVY,
                  background: '#F8FAFC',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.borderColor = BLUE;
                  e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.background = '#F8FAFC';
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Field 3: Max Upload Size */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Max Upload Size (MB)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <HardDrive size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
              <input
                type="number"
                min="1"
                max="100"
                value={platformConfig.maxUploadSizeMB}
                onChange={(e) => setPlatformConfig({ ...platformConfig, maxUploadSizeMB: Number(e.target.value) })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                  borderRadius: '0.625rem',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.8125rem',
                  color: NAVY,
                  background: '#F8FAFC',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.borderColor = BLUE;
                  e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.background = '#F8FAFC';
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Field 4: Allowed Formats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Allowed File Formats
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <FileText size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem' }} />
              <input
                type="text"
                value={platformConfig.allowedFormats}
                onChange={(e) => setPlatformConfig({ ...platformConfig, allowedFormats: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0.5rem 0.85rem 0.5rem 2.4rem',
                  borderRadius: '0.625rem',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.8125rem',
                  color: NAVY,
                  background: '#F8FAFC',
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.background = '#FFFFFF';
                  e.target.style.borderColor = BLUE;
                  e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.background = '#F8FAFC';
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shop Verification Rules Card */}
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(6,63,92,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              background: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={17} color={BLUE} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
            Shop Verification Rules
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Rule 1 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: '#F8FAFC',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileCheck size={18} color={BLUE} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: NAVY }}>
                  Require DTI &amp; Mayor's Permit
                </div>
                <div style={{ fontSize: '0.76rem', color: GRAY, marginTop: '0.15rem' }}>
                  Shops must submit legal municipality permits before accepting customer orders.
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={platformConfig.requireBothPermitAndDti}
              onChange={() => handleToggle('requireBothPermitAndDti')}
              ariaLabel="Require DTI and Mayor's Permit"
            />
          </div>

          {/* Rule 2 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: '#F8FAFC',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MapPin size={18} color={BLUE} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: NAVY }}>
                  Require Storefront Map Location
                </div>
                <div style={{ fontSize: '0.76rem', color: GRAY, marginTop: '0.15rem' }}>
                  Pinpoint exact shop coordinates for the Naval interactive map directory.
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={platformConfig.requireLocationPinpoint}
              onChange={() => handleToggle('requireLocationPinpoint')}
              ariaLabel="Require Storefront Map Location"
            />
          </div>

          {/* Rule 3 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: '#F8FAFC',
              borderRadius: '0.75rem',
              border: '1px solid #E2E8F0',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Bell size={18} color={BLUE} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: NAVY }}>
                  Real-Time System Alerts
                </div>
                <div style={{ fontSize: '0.76rem', color: GRAY, marginTop: '0.15rem' }}>
                  Push live notifications and new registration alerts to the Admin feed.
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={platformConfig.enableRealtimeAlerts}
              onChange={() => handleToggle('enableRealtimeAlerts')}
              ariaLabel="Real-Time System Alerts"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
