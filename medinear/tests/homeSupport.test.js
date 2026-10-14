import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

test('FAQ starts collapsed; button callbacks expand/collapse with matching accessibility attributes', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Faq, FaqItemView } = await vite.ssrLoadModule('/src/components/FaqSection.jsx');
    const { faqItems } = await vite.ssrLoadModule('/src/content/faq.js');
    const markup = renderToString(createElement(Faq));
    assert.match(markup, /Frequently Asked Questions/);
    assert.match(markup, /Everything you need to know about using MediNear\./);
    assert.equal(faqItems.length, 10);
    assert.equal((markup.match(/aria-expanded="false"/g) || []).length, 10);
    assert.equal((markup.match(/aria-hidden="true" inert=""/g) || []).length, 10);
    assert.doesNotMatch(markup, /aria-expanded="true"/);
    for (const item of faqItems) assert.ok(markup.includes(item.question));
    // Exercise the actual presentation button callback using a controlled state harness,
    // following this project's dependency-free React server-rendering test approach.
    let expanded = false;
    const view = () => FaqItemView({ item: faqItems[0], id: 'test-faq', expanded, onToggle: () => { expanded = !expanded; } });
    const render = () => renderToString(view());
    assert.match(render(), /aria-expanded="false"/);
    const click = () => view().props.children[0].props.children.props.onClick();
    click();
    const opened = render();
    assert.match(opened, /aria-expanded="true"/);
    assert.match(opened, /aria-controls="test-faq-answer"/);
    assert.match(opened, /id="test-faq-answer"/);
    assert.match(opened, /aria-labelledby="test-faq-question"/);
    assert.match(opened, /aria-hidden="false"/);
    assert.doesNotMatch(opened, /inert=""/);
    assert.match(opened, /mn-faq-expanded/);
    assert.match(opened, /type="button"/);
    click();
    const closed = render();
    assert.match(closed, /aria-expanded="false"/);
    assert.match(closed, /aria-hidden="true" inert=""/);
    assert.doesNotMatch(closed, /mn-faq-expanded/);
    assert.match(faqItems[4].answer, /availability, then opening status, then distance/);
    assert.match(faqItems[9].answer, /does not submit a real pharmacy order or process payments/);
  } finally { await vite.close(); }
});

test('footer links target existing routes/anchors, customer favorites are conditional, and year is dynamic', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Footer } = await vite.ssrLoadModule('/src/components/SiteFooter.jsx');
    const { default: Home } = await vite.ssrLoadModule('/src/pages/Home.jsx');
    const { AuthContext } = await vite.ssrLoadModule('/src/auth/AuthContext.jsx');
    const render = (element, user) => renderToString(createElement(MemoryRouter, {}, createElement(AuthContext.Provider, { value: { user } }, element))).replace(/<!--.*?-->/g, '');
    const customer = render(createElement(Footer), { role: 'customer' });
    assert.match(customer, /Find the medicine you need, closer to you\./);
    assert.ok(customer.includes(`© ${new Date().getFullYear()} MediNear`));
    assert.match(customer, /Saved Pharmacies/);
    for (const user of [null, { role: 'pharmacy_owner' }]) assert.doesNotMatch(render(createElement(Footer), user), /Saved Pharmacies/);
    assert.doesNotMatch(customer, /href="\/(privacy|contact)"/);
    const routes = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
    const home = render(createElement(Home), { role: 'customer' });
    for (const [, href] of customer.matchAll(/href="([^"]+)"/g)) {
      if (href.startsWith('#')) assert.ok(home.includes(`id="${href.slice(1)}"`), href);
      else assert.ok(routes.includes(`path="${href}"`), href);
    }
    // Support sections follow search/map and do not replace existing controls.
    assert.ok(home.indexOf('id="pharmacy-map"') < home.indexOf('id="faq"'));
    assert.ok(home.indexOf('id="faq"') < home.indexOf('<footer'));
    assert.ok(home.indexOf('</main>') < home.indexOf('<footer'));
    for (const text of ['Search medicine...', 'Use My Location', 'Emergency Mode', 'Available Only', 'Reset Filters', 'Province', 'District', 'Saved pharmacies', 'Google pharmacy map']) assert.ok(home.includes(text), text);
  } finally { await vite.close(); }
});

