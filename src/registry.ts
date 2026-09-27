import type { ComponentType } from 'preact';

export type Category = 'Documents' | 'Privacy' | 'Images' | 'Developer' | 'Everyday';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
  keywords: string[];
  load: () => Promise<{ default: ComponentType }>;
}

// To add a tool: create src/tools/<id>/index.tsx (default-export a component) and add an entry here.
export const tools: Tool[] = [
  {
    id: 'date-duration',
    name: 'Date Duration Calculator',
    description: 'Find the time between two dates, or add/subtract time from a date.',
    icon: '📅', category: 'Everyday',
    keywords: ['date', 'days', 'between', 'age', 'countdown', 'add', 'subtract', 'business days', 'weeks'],
    load: () => import('./tools/date-duration'),
  },
  {
    id: 'pdf-toolkit',
    name: 'PDF Toolkit',
    description: 'Merge, split, reorder, rotate and delete PDF pages. Files never leave your device.',
    icon: '📄', category: 'Documents',
    keywords: ['pdf', 'merge', 'combine', 'split', 'extract', 'rotate', 'pages', 'reorder', 'delete'],
    load: () => import('./tools/pdf-toolkit'),
  },
  {
    id: 'pdf-sanitizer',
    name: 'PDF Sanitizer',
    description: 'Strips hidden author/software info, embedded metadata, attachments and JavaScript from a PDF.',
    icon: '🧼', category: 'Documents',
    keywords: ['pdf', 'metadata', 'sanitize', 'clean', 'author', 'producer', 'javascript', 'attachments', 'privacy'],
    load: () => import('./tools/pdf-sanitizer'),
  },
  {
    id: 'pdf-sign',
    name: 'PDF Sign',
    description: 'Draw a signature and place it on a PDF page.',
    icon: '✍️', category: 'Documents',
    keywords: ['pdf', 'sign', 'signature', 'esign', 'initial'],
    load: () => import('./tools/pdf-sign'),
  },
  {
    id: 'pdf-images',
    name: 'PDF ⇄ Images',
    description: 'Turn photos into a PDF, or export a PDF\'s pages as images.',
    icon: '🖨️', category: 'Documents',
    keywords: ['pdf', 'image', 'convert', 'jpg', 'png', 'export', 'pages to images', 'images to pdf'],
    load: () => import('./tools/pdf-images'),
  },
  {
    id: 'pdf-watermark',
    name: 'PDF Watermark & Page Numbers',
    description: 'Stamp text or page numbers onto every page of a PDF.',
    icon: '💧', category: 'Documents',
    keywords: ['pdf', 'watermark', 'stamp', 'page numbers', 'draft', 'confidential'],
    load: () => import('./tools/pdf-watermark'),
  },
  {
    id: 'pdf-form-fill',
    name: 'PDF Form Filler',
    description: 'Fill in a PDF\'s form fields and optionally make them permanent.',
    icon: '📝', category: 'Documents',
    keywords: ['pdf', 'form', 'fill', 'fillable', 'acroform', 'flatten'],
    load: () => import('./tools/pdf-form-fill'),
  },
  {
    id: 'redactor',
    name: 'Redactor',
    description: 'Blacks out sensitive parts of an image or PDF by flattening it to a picture, so nothing survives underneath.',
    icon: '⬛', category: 'Privacy',
    keywords: ['redact', 'redaction', 'black out', 'censor', 'hide', 'blur', 'pdf', 'image', 'privacy'],
    load: () => import('./tools/redactor'),
  },
  {
    id: 'file-encryptor',
    name: 'File Encryptor',
    description: 'Locks any file with a passphrase (AES-256-GCM), entirely on your device.',
    icon: '🔐', category: 'Privacy',
    keywords: ['encrypt', 'decrypt', 'file', 'password', 'lock', 'aes', 'privacy', 'secure'],
    load: () => import('./tools/file-encryptor'),
  },
  {
    id: 'pii-finder',
    name: 'PII Finder',
    description: 'Finds emails, phone numbers, card numbers and other personal data in text before you share it.',
    icon: '🕵️', category: 'Privacy',
    keywords: ['pii', 'personal data', 'privacy', 'redact', 'email', 'phone', 'credit card', 'ssn', 'scan'],
    load: () => import('./tools/pii-finder'),
  },
  {
    id: 'metadata-stripper',
    name: 'Photo Metadata Stripper',
    description: 'See and remove EXIF, GPS location and other hidden data from photos without re-encoding.',
    icon: '🧹', category: 'Images',
    keywords: ['exif', 'gps', 'location', 'metadata', 'strip', 'remove', 'privacy', 'photo', 'clean'],
    load: () => import('./tools/metadata-stripper'),
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    description: 'Crop, rotate, shrink and resize photos on your device. Strips hidden metadata too.',
    icon: '🖼️', category: 'Images',
    keywords: ['image', 'photo', 'compress', 'resize', 'shrink', 'crop', 'rotate', 'jpeg', 'png', 'webp', 'size'],
    load: () => import('./tools/image-compressor'),
  },
  {
    id: 'qr-tools',
    name: 'QR Generator & Scanner',
    description: 'Make QR codes for links, text and Wi-Fi, or scan them with your camera.',
    icon: '📱', category: 'Images',
    keywords: ['qr', 'code', 'scan', 'scanner', 'generate', 'wifi', 'barcode', 'link'],
    load: () => import('./tools/qr-tools'),
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: "Strong random passwords and passphrases from your device's secure random source.",
    icon: '🔑', category: 'Privacy',
    keywords: ['password', 'passphrase', 'random', 'generate', 'secure', 'entropy'],
    load: () => import('./tools/password-generator'),
  },
  {
    id: 'encrypted-notes',
    name: 'Encrypted Notes',
    description: 'A passphrase-locked notebook stored encrypted on this device.',
    icon: '🔒', category: 'Privacy',
    keywords: ['notes', 'encrypted', 'private', 'vault', 'secure', 'notebook', 'passphrase'],
    load: () => import('./tools/encrypted-notes'),
  },
  {
    id: 'encoder-decoder',
    name: 'Text Encoder/Decoder',
    description: 'Convert text to and from Base64, URL and hex encoding.',
    icon: '🔡', category: 'Developer',
    keywords: ['base64', 'url encode', 'percent encode', 'hex', 'encode', 'decode'],
    load: () => import('./tools/encoder-decoder'),
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    description: 'Decodes a JSON Web Token and optionally checks an HS256 signature.',
    icon: '🪪', category: 'Developer',
    keywords: ['jwt', 'json web token', 'decode', 'auth', 'token', 'jwt.io'],
    load: () => import('./tools/jwt-decoder'),
  },
  {
    id: 'hash-checksum',
    name: 'Hash & Checksum',
    description: 'MD5, SHA-1, SHA-256, SHA-384 and SHA-512 for text or a file.',
    icon: '🧮', category: 'Developer',
    keywords: ['hash', 'checksum', 'md5', 'sha1', 'sha256', 'sha512', 'verify', 'integrity'],
    load: () => import('./tools/hash-checksum'),
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Formats, minifies and validates JSON.',
    icon: '{ }', category: 'Developer',
    keywords: ['json', 'format', 'pretty print', 'minify', 'validate', 'lint'],
    load: () => import('./tools/json-formatter'),
  },
  {
    id: 'uuid-generator',
    name: 'UUID Generator',
    description: 'Generates random (v4) or time-ordered (v7) UUIDs.',
    icon: '🆔', category: 'Developer',
    keywords: ['uuid', 'guid', 'generate', 'unique id', 'v4', 'v7'],
    load: () => import('./tools/uuid-generator'),
  },
  {
    id: 'csv-json',
    name: 'CSV ⇄ JSON',
    description: 'Converts between CSV and an array of JSON objects.',
    icon: '📊', category: 'Developer',
    keywords: ['csv', 'json', 'convert', 'spreadsheet', 'table', 'data'],
    load: () => import('./tools/csv-json'),
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Tests a regular expression against text, with a watchdog against runaway patterns.',
    icon: '🧩', category: 'Developer',
    keywords: ['regex', 'regular expression', 'pattern', 'match', 'test'],
    load: () => import('./tools/regex-tester'),
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    description: 'Converts between Unix time and calendar dates, in any time zone.',
    icon: '⏱️', category: 'Developer',
    keywords: ['unix', 'epoch', 'timestamp', 'time zone', 'convert', 'date'],
    load: () => import('./tools/timestamp-converter'),
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    description: 'Compare two texts by line, word or character.',
    icon: '🔍', category: 'Developer',
    keywords: ['diff', 'compare', 'text', 'difference', 'changes', 'merge'],
    load: () => import('./tools/text-diff'),
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Length, mass, volume, temperature, data storage and more.',
    icon: '📏', category: 'Everyday',
    keywords: ['unit', 'convert', 'length', 'weight', 'mass', 'volume', 'temperature', 'speed', 'bytes', 'metric', 'imperial'],
    load: () => import('./tools/unit-converter'),
  },
  {
    id: 'loan-calculator',
    name: 'Loan Calculator',
    description: 'Monthly payment and full amortization schedule for a loan.',
    icon: '💳', category: 'Everyday',
    keywords: ['loan', 'mortgage', 'amortization', 'payment', 'interest', 'finance'],
    load: () => import('./tools/loan-calculator'),
  },
  {
    id: 'percentage-tip',
    name: 'Percentage & Tip',
    description: 'Percentage calculations, and splitting a bill with tip.',
    icon: '➗', category: 'Everyday',
    keywords: ['percent', 'percentage', 'tip', 'split', 'bill', 'gratuity'],
    load: () => import('./tools/percentage-tip'),
  },
  {
    id: 'word-counter',
    name: 'Word Counter',
    description: 'Words, characters, sentences and estimated reading time.',
    icon: '✏️', category: 'Everyday',
    keywords: ['word count', 'character count', 'reading time', 'text stats'],
    load: () => import('./tools/word-counter'),
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    description: 'Renders Markdown live, side by side with the source.',
    icon: '📖', category: 'Everyday',
    keywords: ['markdown', 'md', 'preview', 'render', 'readme'],
    load: () => import('./tools/markdown-preview'),
  },
  {
    id: 'timezone-planner',
    name: 'Time Zone Planner',
    description: 'Compares a meeting time across several cities at once.',
    icon: '🌍', category: 'Everyday',
    keywords: ['time zone', 'timezone', 'meeting', 'world clock', 'cities', 'schedule'],
    load: () => import('./tools/timezone-planner'),
  },
];

export const categories: Category[] = ['Documents', 'Privacy', 'Images', 'Developer', 'Everyday'];

export function searchTools(query: string, category?: Category | null): Tool[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const base = category ? tools.filter((t) => t.category === category) : tools;
  if (!terms.length) return base;
  return base.filter((t) => {
    const hay = [t.name, t.description, ...t.keywords].join(' ').toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}
