import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { CONFIGURED_PROGRAMMES } from '../config/programmeCatalogue';

// A successful empty live feed remains empty. Only an unavailable feed uses the
// configured identity catalogue, never as evidence of active intake.
export function useProgrammeCatalogue() {
  const [state, setState] = useState({ programs: [], loading: true, configured: false });
  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await api.getPrograms();
      if (!Array.isArray(data?.programs)) throw new Error('Invalid programme feed');
      setState({ programs: data.programs, loading: false, configured: false });
    } catch {
      setState({ programs: CONFIGURED_PROGRAMMES, loading: false, configured: true });
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}
