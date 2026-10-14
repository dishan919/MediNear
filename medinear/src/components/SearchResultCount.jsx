import { searchResultCountText } from '../utils/searchResults';
export default function SearchResultCount({ results, loading, error }) {
  const text = loading || error ? '' : searchResultCountText(results);
  // Keep the live region mounted; announce only completed, successful visible results.
  return <span className={text ? 'mn-result-count' : 'mn-sr-only'} role="status" aria-live="polite" aria-atomic="true">{text}</span>;
}
