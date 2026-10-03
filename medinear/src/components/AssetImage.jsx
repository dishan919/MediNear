import { useState } from 'react';
import { imageSource } from '../utils/medicineDisplay';
export default function AssetImage({ src, alt, kind = 'medicine', className = '' }) {
  const [failed, setFailed] = useState('');
  const safe = imageSource(src, kind), fallback = imageSource('', kind);
  return <img src={failed === safe ? fallback : safe} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(safe)} />;
}
