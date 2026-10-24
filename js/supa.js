import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_CLE } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_CLE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'famille-auth' },
  realtime: { params: { eventsPerSecond: 5 } }
});

// Traduit les messages d'erreur courants
export function messageErreur(e) {
  const m = (e && (e.message || e.error_description || e.error)) || String(e || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Confirme d\'abord ton adresse e-mail (regarde ta boîte mail).';
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet e-mail. Connecte-toi.';
  if (/Password should be at least/i.test(m)) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Pas de connexion Internet.';
  return m.replace(/^Error:\s*/, '');
}
