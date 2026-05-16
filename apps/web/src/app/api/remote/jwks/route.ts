import { getPublicKeyJwk } from "@struxa/api/lib/jwt";

export async function GET() {
  const jwk = await getPublicKeyJwk();
  return Response.json({
    keys: [{ ...jwk, use: "sig", alg: "RS256" }],
  });
}
