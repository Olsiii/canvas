import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { env } from "../env";

export interface SsoConfigInput {
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
}

/** This SP's own entityId — conventionally its metadata URL, one per workspace. */
export function spEntityId(workspaceId: string): string {
  return `${env.API_URL}/auth/saml/${workspaceId}/metadata`;
}

function acsUrl(workspaceId: string): string {
  return `${env.API_URL}/auth/saml/${workspaceId}/callback`;
}

/**
 * Builds an SP-initiated `node-saml` client scoped to one workspace's IdP
 * config.
 *
 * - `wantAssertionsSigned: true` is the security-critical property: the
 *   assertion (the actual authenticated identity data) must be signed.
 * - `wantAuthnResponseSigned: false` — node-saml defaults this to `true`
 *   (requiring the *outer* `<Response>` envelope to carry its own separate
 *   signature too), but "sign the assertion" is the standard, widely
 *   interoperable IdP configuration (Okta, Azure AD, etc. default to
 *   exactly this); requiring both is stricter than most real IdPs ship.
 * - `validateInResponseTo: never` — a deliberate v1 simplification (no
 *   request-id tracking store): NotOnOrAfter/audience/signature checks
 *   still apply per-assertion, so this only widens the replay window to
 *   the assertion's own validity period rather than a single use, not a
 *   bypass of signature/expiry verification. See PROGRESS.md (Phase 6
 *   decisions).
 */
export function buildSamlClient(config: SsoConfigInput, workspaceId: string): SAML {
  return new SAML({
    issuer: spEntityId(workspaceId),
    callbackUrl: acsUrl(workspaceId),
    entryPoint: config.idpSsoUrl,
    idpCert: config.idpCertificate,
    idpIssuer: config.idpEntityId,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.never,
  });
}

/**
 * SP metadata (issuer/ACS URL) never depends on the IdP's own fields — an
 * admin needs this to configure their IdP *before* they necessarily know
 * the IdP's SSO URL/cert to paste back in, so this stays available even
 * with no `sso_configs` row yet (`idpCert` is a required node-saml
 * constructor field but is never read by `generateServiceProviderMetadata`).
 */
export function buildMetadataOnlySamlClient(workspaceId: string): SAML {
  return new SAML({
    issuer: spEntityId(workspaceId),
    callbackUrl: acsUrl(workspaceId),
    idpCert: "",
  });
}
