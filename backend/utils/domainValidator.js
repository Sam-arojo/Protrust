/**
 * List of free email providers to block during registration
 */
const FREE_EMAIL_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'inbox.com',
  'mail.ru',
  '163.com',
  'qq.com',
  'fastmail.com',
  'hushmail.com',
  'tutanota.com',
  'mailinator.com',
  'guerrillamail.com',
  'temp-mail.org',
  '10minutemail.com'
];

/**
 * STEP 1: Extract domain from email
 */
function extractDomain(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const parts = email.toLowerCase().trim().split('@');
  
  if (parts.length !== 2) {
    return null;
  }
  
  return parts[1];
}

/**
 * STEP 2: Check if domain is a free email provider
 */
function isFreeEmailProvider(domain) {
  if (!domain) {
    return true;
  }
  
  return FREE_EMAIL_PROVIDERS.includes(domain.toLowerCase());
}

/**
 * STEP 3: Validate domain format
 */
function isValidDomainFormat(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  
  // Basic domain validation regex
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  
  return domainRegex.test(domain);
}

/**
 * STEP 4: Check if email matches company domain
 */
function emailMatchesDomain(email, companyDomain) {
  const emailDomain = extractDomain(email);
  
  if (!emailDomain || !companyDomain) {
    return false;
  }
  
  return emailDomain.toLowerCase() === companyDomain.toLowerCase();
}

/**
 * MAIN VALIDATION WORKFLOW
 * Validates corporate email during registration
 */
function validateCorporateEmail(email, companyDomain) {
  const result = {
    valid: true,
    errors: []
  };
  
  // Step 1: Extract email domain
  const emailDomain = extractDomain(email);
  
  if (!emailDomain) {
    result.valid = false;
    result.errors.push('Invalid email format');
    return result;
  }
  
  // Step 2: Check if it's a free provider
  if (isFreeEmailProvider(emailDomain)) {
    result.valid = false;
    result.errors.push('Free email providers (Gmail, Yahoo, etc.) are not allowed. Use your company email.');
    return result;
  }
  
  // Step 3: Validate domain format
  if (!isValidDomainFormat(emailDomain)) {
    result.valid = false;
    result.errors.push('Invalid email domain format');
    return result;
  }
  
  // Step 4: Check if email domain matches provided company domain
  if (!emailMatchesDomain(email, companyDomain)) {
    result.valid = false;
    result.errors.push(`Email domain must match company domain (${companyDomain})`);
    return result;
  }
  
  // Step 5: Validate company domain itself
  if (isFreeEmailProvider(companyDomain)) {
    result.valid = false;
    result.errors.push('Company domain cannot be a free email provider');
    return result;
  }
  
  return result;
}

/**
 * Get suggested company domain from email
 */
function suggestCompanyDomain(email) {
  return extractDomain(email);
}

module.exports = {
  FREE_EMAIL_PROVIDERS,
  extractDomain,
  isFreeEmailProvider,
  isValidDomainFormat,
  emailMatchesDomain,
  validateCorporateEmail,
  suggestCompanyDomain
};
