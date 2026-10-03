import { Link, useLocation } from 'react-router-dom';
import AssetImage from './AssetImage';
import FavoriteButton from './FavoriteButton';
import MedicineCard from './MedicineCard';
import Icon from './Icon';
import { directionsUrl } from '../utils/medicineDisplay';
import '../styles/PharmacyCard.css';
export default function PharmacyCard({ pharmacy, initiallyFavorite = false, onFavoriteChange, onViewMap, selected }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const coordinates = new URLSearchParams();
  for (const key of ['lat', 'lng']) if (search.has(key)) coordinates.set(key, search.get(key));
  const detailPath = `/pharmacy/${pharmacy._id}${coordinates.size ? `?${coordinates}` : ''}`;
  return <article className={`mn-result-card ${selected ? 'mn-selected' : ''}`}>
    <div className="mn-result-top"><AssetImage src={pharmacy.image} alt={`${pharmacy.name} pharmacy`} kind="pharmacy" className="mn-pharmacy-thumb" />
      <div className="mn-result-info"><div className="mn-badge-row"><span className={`mn-badge ${pharmacy.isOpen === true ? 'mn-positive' : pharmacy.isOpen === false ? 'mn-negative' : 'mn-neutral'}`}>{pharmacy.openStatus || 'Hours unavailable'}</span>{pharmacy.open24Hours && <span className="mn-badge mn-blue">24 Hours</span>}</div>
        <h3><Link to={detailPath} state={{ returnTo: `${location.pathname}${location.search}` }}>{pharmacy.name}</Link></h3>
        <p className="mn-hours"><Icon name="clock" size={16} />{pharmacy.hoursToday || 'Hours unavailable'}</p>
        <p className="mn-distance"><Icon name="pin" size={16} />{pharmacy.distance == null ? 'Distance unavailable' : `${pharmacy.distance.toFixed(1)} km away`}</p>
      </div><FavoriteButton pharmacyId={pharmacy._id} initiallyFavorite={initiallyFavorite} onChange={onFavoriteChange} />
    </div>
    <p className="mn-result-address">{pharmacy.address}{pharmacy.district ? `, ${pharmacy.district}` : ''}</p>
    {!!pharmacy.medicines?.length && <div className="mn-result-medicines">{pharmacy.medicines.map(m => <MedicineCard key={m._id} medicine={m} compact timezone={pharmacy.timezone} />)}</div>}
    {pharmacy.rankingReason && <p className="mn-ranking"><Icon name="shield" size={15} />{pharmacy.rank ? `#${pharmacy.rank} recommended` : 'Recommended'}<span>{pharmacy.rankingReason}</span></p>}
    <div className="mn-result-actions"><Link className="mn-button mn-primary" to={detailPath} state={{ returnTo: `${location.pathname}${location.search}` }}>View Details<Icon name="arrow" size={17} /></Link><a className="mn-button mn-secondary" href={directionsUrl(pharmacy)} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={17} />Directions</a>{onViewMap && <button className="mn-text-button" type="button" onClick={() => onViewMap(pharmacy._id)}>View on Map</button>}</div>
  </article>;
}
