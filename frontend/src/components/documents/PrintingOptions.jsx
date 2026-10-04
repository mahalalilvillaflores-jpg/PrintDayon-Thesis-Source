import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const defaults = {
  copies: 1,
  colorMode: 'bw',
  paperSize: 'A4',
  sides: 'single',
  pageRange: 'all',
  customRange: '',
  binding: 'none',
  orientation: 'portrait',
  instructions: '',
};

export default function PrintingOptions({ value, onChange }) {
  const [config, setConfig] = useState(value || defaults);

  const update = (key, val) => {
    const next = { ...config, [key]: val };
    setConfig(next);
    onChange?.(next);
  };

  const Option = ({ label, k, options }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {options.map(({ val, text }) => (
          <button
            key={val}
            type="button"
            onClick={() => update(k, val)}
            style={{
              padding: '0.4rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: config[k] === val ? 700 : 500,
              border: `1.5px solid ${config[k] === val ? '#19398d' : '#e3e3e3'}`,
              background: config[k] === val ? '#eef2fc' : 'white',
              color: config[k] === val ? '#19398d' : '#374151',
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <label style={labelStyle}>Copies</label>
        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #e3e3e3', borderRadius: '0.625rem', overflow: 'hidden' }}>
          <button type="button" onClick={() => update('copies', Math.max(1, config.copies - 1))} style={stepBtn}>
            <Minus size={14} />
          </button>
          <span style={{ padding: '0.4rem 1rem', fontWeight: 700, fontSize: '0.925rem', color: '#19398d', minWidth: '2.5rem', textAlign: 'center' }}>
            {config.copies}
          </span>
          <button type="button" onClick={() => update('copies', config.copies + 1)} style={stepBtn}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <Option label="Color Mode" k="colorMode" options={[{ val: 'bw', text: 'Black & White' }, { val: 'color', text: 'Color' }]} />
      <Option label="Paper Size" k="paperSize" options={[
        { val: 'A4', text: 'A4' },
        { val: 'Letter', text: 'Letter (Short)' },
        { val: 'Legal', text: 'Long (8.5×13)' },
        { val: 'A3', text: 'A3 (Large)' },
        { val: 'A5', text: 'A5 (Booklet)' },
        { val: 'B5', text: 'B5' },
        { val: '4R', text: '4R (Photo)' },
      ]} />
      <Option label="Sides" k="sides" options={[{ val: 'single', text: 'Single-sided' }, { val: 'double', text: 'Double-sided' }]} />
      <Option label="Orientation" k="orientation" options={[{ val: 'portrait', text: 'Portrait' }, { val: 'landscape', text: 'Landscape' }]} />
      <Option label="Binding" k="binding" options={[{ val: 'none', text: 'None' }, { val: 'staple', text: 'Staple' }, { val: 'booklet', text: 'Booklet' }]} />

      <div>
        <label style={labelStyle}>Page Range</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: config.pageRange === 'custom' ? '0.5rem' : 0 }}>
          {[{ val: 'all', text: 'All Pages' }, { val: 'custom', text: 'Custom Range' }].map(({ val, text }) => (
            <button
              key={val}
              type="button"
              onClick={() => update('pageRange', val)}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.825rem',
                fontWeight: config.pageRange === val ? 700 : 500,
                border: `1.5px solid ${config.pageRange === val ? '#19398d' : '#e3e3e3'}`,
                background: config.pageRange === val ? '#eef2fc' : 'white',
                color: config.pageRange === val ? '#19398d' : '#374151',
                cursor: 'pointer',
              }}
            >
              {text}
            </button>
          ))}
        </div>
        {config.pageRange === 'custom' && (
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 1-5, 8, 11-13"
            value={config.customRange}
            onChange={(e) => update('customRange', e.target.value)}
            style={{ maxWidth: '220px' }}
          />
        )}
      </div>

      <div>
        <label style={labelStyle}>Additional Instructions <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Any special printing instructions..."
          value={config.instructions}
          onChange={(e) => update('instructions', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' };
const stepBtn = { padding: '0.4rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' };
