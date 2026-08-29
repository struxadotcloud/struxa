"use client";

import { createContext, useContext } from "react";

type AuthSettings = {
  appName: string;
  logoUrl: string | null;
  ogDescription: string | null;
  socialProviders: string[];
  smtpEnabled: boolean;
};

const AuthSettingsContext = createContext<AuthSettings>({ appName: "Struxa", logoUrl: null, ogDescription: null, socialProviders: [], smtpEnabled: false });

export function AuthSettingsProvider({ value, children }: { value: AuthSettings; children: React.ReactNode }) {
  return <AuthSettingsContext value={value}>{children}</AuthSettingsContext>;
}

export function useAuthSettings() {
  return useContext(AuthSettingsContext);
}
