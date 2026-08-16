export function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatExactBytes(bytes: number): string {
  return Number(bytes || 0).toLocaleString('en-US');
}

export function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.getDate() === date.getDate()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function formatDetailedDate(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';

  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  const isToday = now.toDateString() === date.toDateString();
  if (isToday) {
    return `Today, ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();
  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  };
  return `${date.toLocaleDateString('en-US', options)}, ${timeStr}`;
}

export function getFileCategory(name: string, mimeType?: string | null): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other' {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (mimeType?.includes('pdf') || mimeType?.includes('text/plain')) return 'document';
  if (mimeType?.includes('zip') || mimeType?.includes('tar') || mimeType?.includes('rar')) return 'archive';

  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv', 'braw', 'avi', 'm4v', 'flv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf'].includes(ext)) return 'document';
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'py', 'rs', 'go', 'md', 'txt', 'c', 'cpp', 'h'].includes(ext)) return 'code';
  if (['zip', 'tar', 'gz', '7z', 'rar', 'bz2'].includes(ext)) return 'archive';

  return 'other';
}

export function getFileExtensionLabel(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.toUpperCase() || '';
    if (ext.length <= 5) return ext;
    return ext.slice(0, 4);
  }
  return 'FILE';
}

export function getFileKindDescription(name: string, mimeType?: string | null): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';

  const kindMap: Record<string, string> = {
    braw: 'Blackmagic RAW movie',
    mp4: 'MPEG-4 movie',
    mov: 'QuickTime movie',
    mkv: 'Matroska video',
    webm: 'WebM video',
    avi: 'AVI video',
    png: 'PNG image',
    jpg: 'JPEG image',
    jpeg: 'JPEG image',
    webp: 'WebP image',
    gif: 'GIF image',
    svg: 'Scalable Vector Graphics',
    pdf: 'Portable Document Format (PDF)',
    docx: 'Microsoft Word document',
    doc: 'Microsoft Word document',
    xlsx: 'Microsoft Excel spreadsheet',
    xls: 'Microsoft Excel spreadsheet',
    pptx: 'PowerPoint presentation',
    ppt: 'PowerPoint presentation',
    txt: 'Plain text document',
    md: 'Markdown document',
    json: 'JSON document',
    ts: 'TypeScript source file',
    tsx: 'TypeScript JSX component',
    js: 'JavaScript file',
    jsx: 'JavaScript JSX component',
    py: 'Python script',
    rs: 'Rust source file',
    go: 'Go source file',
    html: 'HTML document',
    css: 'CSS style sheet',
    zip: 'ZIP archive',
    tar: 'TAR archive',
    gz: 'GZIP archive',
    '7z': '7-Zip archive',
    rar: 'RAR archive',
    mp3: 'MP3 audio',
    wav: 'WAV audio',
    flac: 'FLAC audio',
    aac: 'AAC audio',
  };

  if (kindMap[ext]) {
    return kindMap[ext];
  }

  if (mimeType) {
    if (mimeType.startsWith('image/')) return `${ext.toUpperCase() || 'Image'} image`;
    if (mimeType.startsWith('video/')) return `${ext.toUpperCase() || 'Video'} movie`;
    if (mimeType.startsWith('audio/')) return `${ext.toUpperCase() || 'Audio'} sound`;
    if (mimeType.startsWith('text/')) return 'Text document';
  }

  return ext ? `${ext.toUpperCase()} document` : 'Document';
}

