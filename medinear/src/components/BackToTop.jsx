import { useEffect, useState } from 'react';
import Icon from './Icon';
import { scrollBackToTop, trackBackToTop } from '../utils/backToTop';

export function BackToTopView({ visible, onClick }) {
  if (!visible) return null;
  return <button type="button" className="mn-button mn-primary mn-back-to-top" aria-label="Back to top" title="Back to top" onClick={onClick}><Icon name="arrow" /></button>;
}

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => trackBackToTop(window, setVisible), []);
  return <BackToTopView visible={visible} onClick={() => scrollBackToTop(window)} />;
}
