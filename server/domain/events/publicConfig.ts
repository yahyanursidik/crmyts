/** Registration options may be public; staff access links and private groups may not. */
export function publicEventFormConfig(config: Record<string, any> | null | undefined) {
  const { gateAccessToken, staffRegistrationToken, adminInviteCode, whatsappGroupIkhwanUrl, whatsappGroupAkhwatUrl, ...registrationOptions } = config || {};
  return registrationOptions;
}
