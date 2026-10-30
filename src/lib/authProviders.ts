/**
 * "Continuar com Google" on the sign-in page (owner decision, 2026-10-31).
 * Off until the owner enables the Google provider in Supabase (Authentication →
 * Providers → Google, with the OAuth client from Google Cloud); a click before
 * that would only show Supabase's "provider is not enabled" error.
 */
export const GOOGLE_SIGN_IN_ENABLED = false;
