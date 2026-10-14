export default function RecentSearches({ searches, onSearch, onClear }) {
  if (!searches.length) return null;
  return <section className="mn-recent-searches" aria-label="Recent medicine searches">
    <div className="mn-recent-heading"><h2>Recent Searches</h2><button type="button" className="mn-text-button" onClick={onClear}>Clear History</button></div>
    <div className="mn-recent-chips">{searches.map(term => <button type="button" className="mn-recent-chip" key={term.toLowerCase()} onClick={() => onSearch(term)}>{term}</button>)}</div>
    <p>Saved only on this browser. Cleared when you log out.</p>
  </section>;
}
