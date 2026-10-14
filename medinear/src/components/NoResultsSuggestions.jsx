import { hasRestrictiveFilters, noResultsSuggestions } from '../utils/noResultsSuggestions';
export default function NoResultsSuggestions({ params, loading = false, error = '', results = [], onClearFilters }) {
  if (loading || error || results.length) return null;
  const term = (params.get('medicine') || '').trim();
  const displayedTerm = term.length > 120 ? `${term.slice(0, 120)}\u2026` : term;
  return <section className="mn-no-results" aria-label="No results suggestions">
    {term && <p className="mn-no-results-query">No matches for "{displayedTerm}".</p>}
    <h3>Try these suggestions</h3><ul>{noResultsSuggestions(params).map(suggestion => <li key={suggestion}>{suggestion}</li>)}</ul>
    {hasRestrictiveFilters(params) && <button type="button" className="mn-button mn-secondary" onClick={onClearFilters}>Clear Filters</button>}
  </section>;
}
