import { SignedXml } from "xml-crypto";

// A fixed, checked-in self-signed test certificate/key pair (openssl
// req -x509 -newkey rsa:2048 -nodes -days 36500 -subj "/CN=canvas-test-idp")
// — this is what stands in for a real IdP's signing cert in the SSO spec.
// Test-only: never used for anything but signing fixture SAMLResponses here.
export const TEST_IDP_CERT = `-----BEGIN CERTIFICATE-----
MIICsjCCAZoCCQCel8bjxziWzTANBgkqhkiG9w0BAQsFADAaMRgwFgYDVQQDDA9j
YW52YXMtdGVzdC1pZHAwIBcNMjYwNzIzMDkwMDMyWhgPMjEyNjA2MjkwOTAwMzJa
MBoxGDAWBgNVBAMMD2NhbnZhcy10ZXN0LWlkcDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBALHIJv3Nr2+Nmi7ZQogdN3wjuFHeHm5hq7SkabIiIi1GP2f7
XxrViHLLagV/h0KaPnvGu7jRNsJpyeSIVHP5g0EHp5KIoxmBYww6ZWAaCpAtO9ny
7Z/vF7rPL+3LhqYiJKTBWDX/aPd7rRGqWAa42blhCK99EoXQPSowXNmp1ciBKM5Y
awOijdGyKXfoLUhEHiLa/QFv5YIyu7gNznXfV021hHrRfBuyGK/qsiZsxdMIT7cX
E+uuhpkkULRfBSD6f9zzhcWMxCeeQApeB4Rk7mn7kCfOQwLpPARbuDp2r2QxCGLm
LRLK4uXGkaWKgKOVZmT47LwcX8/EYqhEmEuWJG0CAwEAATANBgkqhkiG9w0BAQsF
AAOCAQEAiFn0p13fQEBZs/2BaHIypcEIhEXx94Y/gHFt9xtwuOzCnfRShl/4JLtb
K50oT/SQDcCq56j73XH7iIu0hvZVrIamwIAMScJo/sIy5GXV2i7SPC8QSmd9EiK9
nJK3T4we6WgPl6/elBRdva1/ug8fN2ojD3SZZzY7aURzFi+sW18wD/a5Y8fzTDw/
IWn+Yc6/LDu13ZNXUhzLczVY1hbxjus9UP8/OFKs1etg30CC6+d8KNIEGo7EjKJG
zvi8RUrVNln1b2rR+1xkOb8sdBKbqw1v/9WDdDceVfz/sY+QsXXHLFRcRZERfXMJ
AuK01FYp9W+Dj7MqVtX06AkXWnP0rw==
-----END CERTIFICATE-----`;

const TEST_IDP_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCxyCb9za9vjZou
2UKIHTd8I7hR3h5uYau0pGmyIiItRj9n+18a1Yhyy2oFf4dCmj57xru40TbCacnk
iFRz+YNBB6eSiKMZgWMMOmVgGgqQLTvZ8u2f7xe6zy/ty4amIiSkwVg1/2j3e60R
qlgGuNm5YQivfRKF0D0qMFzZqdXIgSjOWGsDoo3Rsil36C1IRB4i2v0Bb+WCMru4
Dc5131dNtYR60Xwbshiv6rImbMXTCE+3FxPrroaZJFC0XwUg+n/c84XFjMQnnkAK
XgeEZO5p+5AnzkMC6TwEW7g6dq9kMQhi5i0SyuLlxpGlioCjlWZk+Oy8HF/PxGKo
RJhLliRtAgMBAAECggEAN74/Y5NLr9mhf5EFyHIIxLbag2j297tOQGzQ61bCipmd
JfhugJZ1mzDmxGSRP7PnZZ4RnEiVN+49rJeGi3qvygMhatPG+CdWrC3fPXvM1hoo
yxTdpykrsppmN9R6GrtX7ATnqL615et0f7Z+tVTeh77CH2xDE4wQsZrKckFLU/uN
muHAxfi2pp5SNwADFdVWpePt+oK7ZekdQo4NU/mOBOq32kE4Fr4h4hKtyMFveTnP
i9RKaHNyl1yKRYPPOHqV/d1giql3AW5lpofKfIrL45wTgbnomWrnKVZeEAoKnYqJ
y4Cj94sKmnGiVk1rGywwSs7NtBs/0ARPVrwoWJRnIQKBgQDhGKY65697vvtHpb8q
SUkI9UV3C2uDaSycXGxGypLxKs63AfU1KbvED4UVXb1XQO6Kn21vXdt7LzpkqPc2
RpkE9M4lMPW0tiSi32iz7gCakFaPBDPF17qTxuEuJ96M3P9eejNTmlMuL1rPJbqs
ex4nGTHA2L0Bwt0lZT9ZZtLdaQKBgQDKMJCq7IDVzzrG/qt++vBppAC9G3HT/lUa
sLclZl6gCQ3vqEMp5+5GXzwEUTKWUOd9/IsnsL78lB6y5h4cEHanI8DJPWVxs3XQ
LzBD5g616ioRMy7sGnUTQGmERks1+vO7DPvCrrwS4HOMe2ecvMZjJncMKKCWDvHi
8Mdj/AM6ZQKBgCgA2HH5gM9OJpwaEbozIf6skDbS2b2V8G6tYjTGhYzEnc4aU/ip
vQvf8jfU2/Rovrv2D13OYVYoE4mWGbEUpNcjposng1MlV6d2asYnUwYlBq0OAyFy
8F6Y5qXsQfnowJ2KvBpsf8HiepH704wZqUcrjBMIsbZhaineL3707h6ZAoGAYmy3
z+znXq3NgBdzJpJDvDlQ/r3AcKFrjl2eGj+2KpOdzB+N6nV0AZ/UmIlqZdAmkKcC
mqSopE36j74DxEejawO1koEnw+zHmjuOdE8mtBm0tsDCw76xZVjCxNhvPmzWfyT3
3bKv7USEG0vriVo//P45j5qracEGsSHi/mIstB0CgYByP16aI/PxytNylYCRl2MG
fZ4KD38t2jOPmyZZvlBXRhZLJIAEDoMOKm9VQKnvcZBdUlJO2LE0rMXrvZO5B6/Y
OOJZgOwxjPUh0UufYE2Ulhyd1+DRYRaF2cwUEw7ZU0XwD2zk3hPk13Dmf2RlBa2k
q2rqZ2bBDjuvo/jQRXL1ZQ==
-----END PRIVATE KEY-----`;

export const TEST_IDP_ENTITY_ID = "https://idp.test/canvas-test-idp";

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace(/\.\d+Z$/, "Z");
}

/**
 * Builds a real SAML 2.0 HTTP-POST Response, signed with xml-crypto against
 * TEST_IDP_KEY/CERT — the same enveloped-signature shape node-saml expects
 * (Signature inserted right after the Assertion's own Issuer). Signing with
 * the sibling library node-saml itself uses internally (xml-crypto) removes
 * any risk of a canonicalization mismatch between "how this test signs" and
 * "how the app verifies" being the actual thing under test, rather than the
 * app's real SAML handling.
 */
export function buildSignedSamlResponse(opts: {
  workspaceId: string;
  email: string;
  apiOrigin?: string;
}): string {
  const apiOrigin = opts.apiOrigin ?? "http://localhost:3001";
  const acsUrl = `${apiOrigin}/auth/saml/${opts.workspaceId}/callback`;
  const audience = `${apiOrigin}/auth/saml/${opts.workspaceId}/metadata`;
  const responseId = `_response_${Date.now()}`;
  const assertionId = `_assertion_${Date.now()}`;
  const now = isoNow();
  const notBefore = isoNow(-60_000);
  const notOnOrAfter = isoNow(5 * 60_000);

  const assertionXml =
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${assertionId}" IssueInstant="${now}" Version="2.0">` +
    `<saml:Issuer>${TEST_IDP_ENTITY_ID}</saml:Issuer>` +
    `<saml:Subject>` +
    `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${opts.email}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData Recipient="${acsUrl}" NotOnOrAfter="${notOnOrAfter}"/>` +
    `</saml:SubjectConfirmation>` +
    `</saml:Subject>` +
    `<saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now}" SessionIndex="_session_${Date.now()}">` +
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>` +
    `</saml:AuthnStatement>` +
    `</saml:Assertion>`;

  const sig = new SignedXml({ privateKey: TEST_IDP_KEY, publicCert: TEST_IDP_CERT });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    uri: `#${assertionId}`,
  });
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.computeSignature(assertionXml, {
    location: { reference: "//*[local-name(.)='Issuer']", action: "after" },
  });
  const signedAssertionXml = sig.getSignedXml();

  const responseXml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${responseId}" Version="2.0" IssueInstant="${now}" Destination="${acsUrl}">` +
    `<saml:Issuer>${TEST_IDP_ENTITY_ID}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    signedAssertionXml +
    `</samlp:Response>`;

  return Buffer.from(responseXml, "utf8").toString("base64");
}
