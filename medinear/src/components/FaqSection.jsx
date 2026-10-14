import { useId, useState } from 'react';

import '../styles/HomeSupport.css';
import { faqItems } from '../content/faq';




export function FaqItemView({ item, id, expanded, onToggle }) {

  return <article className={`mn-faq-item${expanded ? ' mn-faq-expanded' : ''}`}>

    <h3><button type="button" id={`${id}-question`} className="mn-faq-question" aria-expanded={expanded} aria-controls={`${id}-answer`} onClick={onToggle}>

      <span>{item.question}</span><span className="mn-faq-indicator" aria-hidden="true">{expanded ? '\u2212' : '+'}</span>

    </button></h3>

    <div id={`${id}-answer`} className="mn-faq-answer" aria-labelledby={`${id}-question`} aria-hidden={!expanded} inert={!expanded}>

      <div className="mn-faq-answer-inner"><p>{item.answer}</p></div>

    </div>

  </article>;

}



function FaqItem({ item, id }) {

  const [expanded, setExpanded] = useState(false);

  return <FaqItemView item={item} id={id} expanded={expanded} onToggle={() => setExpanded(value => !value)} />;

}



export default function FaqSection() {

  const id = useId();

  return <section className="mn-faq" id="faq" aria-labelledby={`${id}-title`} tabIndex={-1}>

    <div className="mn-faq-heading"><p className="mn-eyebrow">A little help along the way</p><h2 id={`${id}-title`}>Frequently Asked Questions</h2><p>Everything you need to know about using MediNear.</p></div>

    <div className="mn-faq-list">{faqItems.map((item, index) => <FaqItem key={item.question} item={item} id={`${id}-${index}`} />)}</div>

  </section>;

}

