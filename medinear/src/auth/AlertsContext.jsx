import { createContext, useContext } from 'react';
export const AlertsContext = createContext(null);
export const useAlerts = () => useContext(AlertsContext);
