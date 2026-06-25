export interface ProviderConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  serviceId?: string;
}

export interface WebhookContext {
  rawBody: string;
  headers: Record<string, string>;
  config: ProviderConfig;
  gatewayId: string;
  sourceIp?: string;
}

export type WebhookPayload =
  | {
      type: "topup.succeeded";
      userId: string;
      amountCents: number;
      currency: string;
      providerTransactionId: string;
      gatewayId: string;
    }
  | {
      type: "topup.failed";
      userId: string;
      providerTransactionId: string;
      gatewayId: string;
    };
