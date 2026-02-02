// 文件编码服务 - 支持多种编码格式（类似 VSCode）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const iconv = require('iconv-lite') as { decode: (buf: Buffer, enc: string) => string; encode: (str: string, enc: string) => Buffer };
import fs from 'fs';

// 支持的编码列表（VSCode 风格）
export const SUPPORTED_ENCODINGS = [
  { id: 'utf8', label: 'UTF-8', aliases: ['utf-8'] },
  { id: 'utf8bom', label: 'UTF-8 with BOM', aliases: [] },
  { id: 'utf16le', label: 'UTF-16 LE', aliases: ['utf-16le', 'ucs-2'] },
  { id: 'utf16be', label: 'UTF-16 BE', aliases: ['utf-16be'] },
  { id: 'gbk', label: 'GBK', aliases: ['gb2312', 'cp936', 'chinese'] },
  { id: 'gb18030', label: 'GB18030', aliases: [] },
  { id: 'big5', label: 'Big5', aliases: ['big5-hkscs'] },
  { id: 'shiftjis', label: 'Shift JIS', aliases: ['shift-jis', 'sjis', 'cp932'] },
  { id: 'eucjp', label: 'EUC-JP', aliases: ['euc-jp'] },
  { id: 'euckr', label: 'EUC-KR', aliases: ['euc-kr', 'korean'] },
  { id: 'iso88591', label: 'ISO 8859-1 (Latin-1)', aliases: ['iso-8859-1', 'latin1'] },
  { id: 'iso88592', label: 'ISO 8859-2 (Latin-2)', aliases: ['iso-8859-2', 'latin2'] },
  { id: 'iso88595', label: 'ISO 8859-5 (Cyrillic)', aliases: ['iso-8859-5'] },
  { id: 'iso885915', label: 'ISO 8859-15 (Latin-9)', aliases: ['iso-8859-15', 'latin9'] },
  { id: 'windows1250', label: 'Windows 1250', aliases: ['cp1250'] },
  { id: 'windows1251', label: 'Windows 1251 (Cyrillic)', aliases: ['cp1251'] },
  { id: 'windows1252', label: 'Windows 1252 (Western)', aliases: ['cp1252'] },
  { id: 'windows1253', label: 'Windows 1253 (Greek)', aliases: ['cp1253'] },
  { id: 'windows1254', label: 'Windows 1254 (Turkish)', aliases: ['cp1254'] },
  { id: 'windows1255', label: 'Windows 1255 (Hebrew)', aliases: ['cp1255'] },
  { id: 'windows1256', label: 'Windows 1256 (Arabic)', aliases: ['cp1256'] },
  { id: 'koi8r', label: 'KOI8-R', aliases: ['koi8-r'] },
  { id: 'koi8u', label: 'KOI8-U', aliases: ['koi8-u'] },
] as const;

export type EncodingId = typeof SUPPORTED_ENCODINGS[number]['id'];

// 将内部 ID 转换为 iconv-lite 兼容的编码名
function toIconvEncoding(id: string): string {
  const map: Record<string, string> = {
    'utf8': 'utf-8', 'utf8bom': 'utf-8', 'utf16le': 'utf-16le', 'utf16be': 'utf-16be',
    'gbk': 'gbk', 'gb18030': 'gb18030', 'big5': 'big5', 'shiftjis': 'shift_jis',
    'eucjp': 'euc-jp', 'euckr': 'euc-kr', 'iso88591': 'iso-8859-1', 'iso88592': 'iso-8859-2',
    'iso88595': 'iso-8859-5', 'iso885915': 'iso-8859-15', 'windows1250': 'windows-1250',
    'windows1251': 'windows-1251', 'windows1252': 'windows-1252', 'windows1253': 'windows-1253',
    'windows1254': 'windows-1254', 'windows1255': 'windows-1255', 'windows1256': 'windows-1256',
    'koi8r': 'koi8-r', 'koi8u': 'koi8-u',
  };
  return map[id] || id;
}

// 检测文件编码（简单版 - BOM 检测 + 启发式）
export function detectEncoding(buffer: Buffer): EncodingId {
  // 检查 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'utf8bom';
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf16le';
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf16be';
  
  // 启发式检测中文编码 (GBK vs UTF-8)
  let hasHighBytes = false, validUtf8 = true;
  for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
    if (buffer[i] > 127) {
      hasHighBytes = true;
      // 简单 UTF-8 验证
      if ((buffer[i] & 0xE0) === 0xC0) { // 2字节序列
        if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) validUtf8 = false;
        i++;
      } else if ((buffer[i] & 0xF0) === 0xE0) { // 3字节序列
        if (i + 2 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80) validUtf8 = false;
        i += 2;
      } else if ((buffer[i] & 0xF8) === 0xF0) { // 4字节序列
        if (i + 3 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80 || (buffer[i + 3] & 0xC0) !== 0x80) validUtf8 = false;
        i += 3;
      } else if ((buffer[i] & 0xC0) !== 0x80) {
        validUtf8 = false;
      }
    }
  }
  
  if (!hasHighBytes) return 'utf8'; // 纯 ASCII
  if (validUtf8) return 'utf8';
  return 'gbk'; // 如果不是有效 UTF-8，假设是 GBK（中文环境常见）
}

// 读取文件（自动检测或指定编码）
export function readFileWithEncoding(filePath: string, encoding?: EncodingId): { content: string; encoding: EncodingId } {
  const buffer = fs.readFileSync(filePath);
  const detectedEncoding = encoding || detectEncoding(buffer);
  
  let content: string;
  if (detectedEncoding === 'utf8bom') {
    content = buffer.slice(3).toString('utf-8'); // 跳过 BOM
  } else if (detectedEncoding === 'utf8') {
    content = buffer.toString('utf-8');
  } else if (detectedEncoding === 'utf16le') {
    content = buffer.slice(2).toString('utf16le'); // 跳过 BOM
  } else if (detectedEncoding === 'utf16be') {
    content = iconv.decode(buffer.slice(2), 'utf-16be');
  } else {
    content = iconv.decode(buffer, toIconvEncoding(detectedEncoding));
  }
  
  return { content, encoding: detectedEncoding };
}

// 写入文件（指定编码）
export function writeFileWithEncoding(filePath: string, content: string, encoding: EncodingId = 'utf8'): void {
  let buffer: Buffer;
  
  if (encoding === 'utf8') {
    buffer = Buffer.from(content, 'utf-8');
  } else if (encoding === 'utf8bom') {
    buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(content, 'utf-8')]);
  } else if (encoding === 'utf16le') {
    buffer = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(content, 'utf16le')]);
  } else if (encoding === 'utf16be') {
    buffer = Buffer.concat([Buffer.from([0xFE, 0xFF]), iconv.encode(content, 'utf-16be')]);
  } else {
    buffer = iconv.encode(content, toIconvEncoding(encoding));
  }
  
  fs.writeFileSync(filePath, buffer);
}

// 转换编码
export function convertEncoding(content: string, fromEncoding: EncodingId, toEncoding: EncodingId): string {
  if (fromEncoding === toEncoding) return content;
  const buffer = iconv.encode(content, toIconvEncoding(fromEncoding));
  return iconv.decode(buffer, toIconvEncoding(toEncoding));
}

// 获取编码标签
export function getEncodingLabel(id: EncodingId): string {
  const enc = SUPPORTED_ENCODINGS.find(e => e.id === id);
  return enc?.label || id.toUpperCase();
}
