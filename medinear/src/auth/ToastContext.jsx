import { createContext, useContext } from 'react';

export const ToastContext = createContext({ showToast: () => {} });
export function useToast() { return useContext(ToastContext); }
