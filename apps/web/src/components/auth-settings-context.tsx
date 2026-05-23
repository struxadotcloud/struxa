"use client";

import { createContext, useContext } from "react";

type AuthSettings = {
  appName: string;
  logoUrl: string | null;
  socialProviders: string[];
};

const AuthSettingsContext = createContext<AuthSettings>({ appName: "Struxa", logoUrl: null, socialProviders: [] });

export function AuthSettingsProvider({ value, children }: { value: AuthSettings; children: React.ReactNode }) {
  return <AuthSettingsContext value={value}>{children}</AuthSettingsContext>;
}

export function useAuthSettings() {
  return useContext(AuthSettingsContext);
}
