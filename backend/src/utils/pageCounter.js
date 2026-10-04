const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function detectPageCount(filePath, filename = '') {
  try {
    const ext = path.extname(filename || filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext)) {
      return 1;
    }

    if (!fs.existsSync(filePath)) return 1;
    const buf = fs.readFileSync(filePath);

    if (ext === '.pdf') {
      const text = buf.toString('latin1');
      const matches = text.match(/\/Type\s*\/Page\b/g);
      if (matches && matches.length > 0) return matches.length;
      const countMatch = text.match(/\/Count\s+(\d+)/);
      if (countMatch && parseInt(countMatch[1], 10) > 0) return parseInt(countMatch[1], 10);
      return null;
    }

    if (ext === '.docx' || ext === '.doc') {
      let offset = 0;
      while (offset < buf.length - 30) {
        if (buf.readUInt32LE(offset) === 0x04034b50) {
          const compMethod = buf.readUInt16LE(offset + 8);
          const compSize = buf.readUInt32LE(offset + 18);
          const nameLen = buf.readUInt16LE(offset + 26);
          const extraLen = buf.readUInt16LE(offset + 28);
          const name = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
          const dataOffset = offset + 30 + nameLen + extraLen;
          if (name === 'docProps/app.xml') {
            const compData = buf.slice(dataOffset, dataOffset + compSize);
            const xml = compMethod === 8 ? zlib.inflateRawSync(compData).toString('utf8') : compData.toString('utf8');
            const m = xml.match(/<Pages>(\d+)<\/Pages>/i);
            if (m && parseInt(m[1], 10) > 0) return parseInt(m[1], 10);
            break;
          }
          offset = dataOffset + compSize;
        } else {
          offset++;
        }
      }
    }
  } catch (err) {
    console.warn('Page detection warning:', err.message);
  }
  return null;
}

module.exports = { detectPageCount };
