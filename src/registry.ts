import type { ComponentType } from 'preact';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  keywords: string[];
  load: () => Promise<{ default: ComponentType }>;
}

// To add a tool: create src/tools/<id>/index.tsx (default-export a component) and add an entry here.
export const tools: Tool[] = [
  {
    id: 'date-duration',
    name: 'Date Duration Calculator',
    description: 'Find the time between two dates, or add/subtract time from a date.',
    icon: '📅',
    keywords: ['date', 'days', 'between', 'age', 'countdown', 'add', 'subtract', 'business days', 'weeks'],
    load: () => import('./tools/date-duration'),
  },
  {
    id: 'pdf-toolkit',
    name: 'PDF Toolkit',
    description: 'Merge, split, reorder, rotate and delete PDF pages. Files never leave your device.',
    icon: '📄',
    keywords: ['pdf', 'merge', 'combine', 'split', 'extract', 'rotate', 'pages', 'reorder', 'delete'],
    load: () => import('./tools/pdf-toolkit'),
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    description: 'Shrink and resize photos on your device. Strips hidden metadata too.',
    icon: '🖼️',
    keywords: ['image', 'photo', 'compress', 'resize', 'shrink', 'jpeg', 'png', 'webp', 'size'],
    load: () => import('./tools/image-compressor'),
  },
  {
    id: 'metadata-stripper',
    name: 'Photo Metadata Stripper',
    description: 'See and remove EXIF, GPS location and other hidden data from photos without re-encoding.',
    icon: '🧹',
    keywords: ['exif', 'gps', 'location', 'metadata', 'strip', 'remove', 'privacy', 'photo', 'clean'],
    load: () => import('./tools/metadata-stripper'),
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Strong random passwords and passphrases from your device\'s secure random source.',
    icon: '🔑',
    keywords: ['password', 'passphrase', 'random', 'generate', 'secure', 'entropy'],
    load: () => import('./tools/password-generator'),
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Length, mass, volume, temperature, data storage and more.',
    icon: '📏',
    keywords: ['unit', 'convert', 'length', 'weight', 'mass', 'volume', 'temperature', 'speed', 'bytes', 'metric', 'imperial'],
    load: () => import('./tools/unit-converter'),
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    description: 'Compare two texts by line, word or character.',
    icon: '🔍',
    keywords: ['diff', 'compare', 'text', 'difference', 'changes', 'merge'],
    load: () => import('./tools/text-diff'),
  },
  {
    id: 'qr-tools',
    name: 'QR Generator & Scanner',
    description: 'Make QR codes for links, text and Wi-Fi, or scan them with your camera.',
    icon: '📱',
    keywords: ['qr', 'code', 'scan', 'scanner', 'generate', 'wifi', 'barcode', 'link'],
    load: () => import('./tools/qr-tools'),
  },
  {
    id: 'encrypted-notes',
    name: 'Encrypted Notes',
    description: 'A passphrase-locked notebook stored encrypted on this device.',
    icon: '🔒',
    keywords: ['notes', 'encrypted', 'private', 'vault', 'secure', 'notebook', 'passphrase'],
    load: () => import('./tools/encrypted-notes'),
  },
];

export function searchTools(query: string): Tool[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return tools;
  return tools.filter((t) => {
    const hay = [t.name, t.description, ...t.keywords].join(' ').toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}
