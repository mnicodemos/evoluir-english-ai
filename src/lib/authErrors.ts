/**
 * Portuguese messages for Supabase Auth errors on the sign-in, sign-up and
 * password screens (which are Portuguese only). Matches the error code first
 * and the English message as a fallback, since older responses lack codes.
 */
type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const BY_CODE: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed:
    "Seu e-mail ainda não foi confirmado. Abra o link que enviamos ou peça um novo abaixo.",
  user_already_exists: "Já existe uma conta com este e-mail. Entre ou recupere sua senha.",
  email_exists: "Já existe uma conta com este e-mail. Entre ou recupere sua senha.",
  weak_password: "Senha fraca. Use pelo menos 6 caracteres, misturando letras e números.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit: "Muitos pedidos seguidos. Aguarde um minuto e tente de novo.",
  over_request_rate_limit: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
  session_not_found: "Este link expirou ou já foi usado. Peça um novo link.",
  otp_expired: "Este link expirou ou já foi usado. Peça um novo link.",
  email_address_invalid: "Este e-mail não é válido.",
  signup_disabled: "Novos cadastros estão temporariamente fechados.",
};

const BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, BY_CODE["invalid_credentials"]!],
  [/email not confirmed/i, BY_CODE["email_not_confirmed"]!],
  [/already registered|already exists/i, BY_CODE["user_already_exists"]!],
  [/should be different/i, BY_CODE["same_password"]!],
  [/password should be at least|weak password/i, BY_CODE["weak_password"]!],
  [/for security purposes|rate limit|too many/i, BY_CODE["over_email_send_rate_limit"]!],
  [
    /auth session missing|session.*(expired|not found)|expired|invalid.*(token|link)/i,
    BY_CODE["otp_expired"]!,
  ],
  [/failed to fetch|network/i, "Sem conexão. Verifique sua internet e tente de novo."],
];

export function authErrorMessage(error: unknown): string {
  const err = error as AuthErrorLike;
  if (err?.code && BY_CODE[err.code]) return BY_CODE[err.code]!;
  const message = err?.message ?? "";
  for (const [pattern, text] of BY_MESSAGE) if (pattern.test(message)) return text;
  return "Algo deu errado. Tente novamente em instantes.";
}

/** Error sent back in the recovery link itself (e.g. #error_code=otp_expired). */
export function recoveryLinkError(url: URL): string | null {
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  return BY_CODE[code] ?? BY_CODE["otp_expired"]!;
}
