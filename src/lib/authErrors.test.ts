import { describe, expect, it } from "vitest";

import { authErrorMessage, recoveryLinkError } from "./authErrors";

describe("auth errors in Portuguese", () => {
  it("uses the error code first", () => {
    expect(
      authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
    ).toBe("E-mail ou senha incorretos.");
  });

  it("falls back to the English message", () => {
    expect(authErrorMessage(new Error("Email not confirmed"))).toContain(
      "ainda não foi confirmado",
    );
    expect(
      authErrorMessage(
        new Error("For security purposes, you can only request this after 52 seconds."),
      ),
    ).toContain("Aguarde um minuto");
    expect(authErrorMessage(new Error("Auth session missing!"))).toContain("expirou");
    expect(authErrorMessage(new Error("User already registered"))).toContain("Já existe uma conta");
  });

  it("never shows raw English for unknown errors", () => {
    expect(authErrorMessage(new Error("Something odd"))).toBe(
      "Algo deu errado. Tente novamente em instantes.",
    );
    expect(authErrorMessage(null)).toBe("Algo deu errado. Tente novamente em instantes.");
  });

  it("reads an error sent in the recovery link", () => {
    expect(
      recoveryLinkError(
        new URL(
          "https://x.com/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
        ),
      ),
    ).toContain("expirou");
    expect(
      recoveryLinkError(new URL("https://x.com/reset-password#access_token=a&type=recovery")),
    ).toBeNull();
  });
});
