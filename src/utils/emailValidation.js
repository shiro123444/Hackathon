import isEmail from "validator/lib/isEmail.js";
import isFQDN from "validator/lib/isFQDN.js";
import isIP from "validator/lib/isIP.js";
import { parse } from "tldts";

const EMAIL_OPTIONS = {
  require_tld: true,
  allow_ip_domain: true,
  allow_utf8_local_part: true,
  domain_specific_validation: false
};

const FQDN_OPTIONS = {
  require_tld: true,
  allow_underscores: false,
  allow_trailing_dot: false,
  allow_numeric_tld: false
};

const TLDTS_OPTIONS = {
  allowPrivateDomains: false
};

function normalizeDomainLiteral(domain) {
  let normalized = String(domain || "").trim();
  if (!normalized) return "";

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.toLowerCase().startsWith("ipv6:")) {
    normalized = normalized.slice(5);
  }

  return normalized.trim();
}

function normalizeEmailForValidator(email) {
  return email.replace(/@\[IPv6:/i, "@[");
}

function getDomainPart(email) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return "";
  return email.slice(atIndex + 1);
}

export function isValidEmailDomain(domain) {
  const normalized = normalizeDomainLiteral(domain);
  if (!normalized) return false;

  if (isIP(normalized, 4) || isIP(normalized, 6)) return true;
  if (!isFQDN(normalized, FQDN_OPTIONS)) return false;

  const parsed = parse(normalized, TLDTS_OPTIONS);
  return Boolean(parsed.isIcann && parsed.publicSuffix);
}

export function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email) return false;

  const emailForValidator = normalizeEmailForValidator(email);
  if (!isEmail(emailForValidator, EMAIL_OPTIONS)) return false;

  return isValidEmailDomain(getDomainPart(email));
}
