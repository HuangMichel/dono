import { MAX_PHOTO_SIZE_LABEL } from "./photo-limits";

const messages: Record<string, string> = {
  unauthenticated: "Sign in to continue.",
  invalid_token: "Your sign-in could not be verified. Sign in again.",
  account_disabled: "This account is disabled. You cannot make changes.",
  forbidden: "Your account does not have access to this action or information.",
  not_found: "This information is no longer available to your account.",
  stale_revision: "These details changed. Refresh them before trying again.",
  date_context_stale:
    "The date checks have changed. Refresh the details before continuing.",
  active_offer_exists:
    "This item already has an active offer. Withdraw it before making changes or offering it elsewhere.",
  invalid_transition:
    "This action is no longer available. Refresh the page to check the current status.",
  deadline_elapsed:
    "The deadline for this action has passed. Refresh the page to check the current status.",
  demand_exhausted: "This association no longer needs this quantity.",
  storage_exhausted:
    "This association does not have enough storage space for these items.",
  intake_quota_exhausted:
    "No available drop-off date can receive this quantity. Check available dates again.",
  slot_full: "This drop-off time is full. Choose another time.",
  configuration_below_commitment:
    "This limit is below existing bookings, reservations or received quantities. Check the current totals.",
  last_admin_required:
    "The association must keep at least one active administrator.",
  admin_recovery_not_allowed:
    "Administrator access cannot be restored for this association in its current state.",
  duplicate_identifier:
    "An association with this RNA or SIRET number is already registered.",
  already_received: "These items have already been received.",
  already_distributed: "These items have already been given out.",
  idempotency_conflict:
    "This action changed since the previous attempt. Refresh the page and check the current status before continuing.",
  request_in_progress:
    "This action is still processing. Check the current status before trying again.",
  intake_date_restriction:
    "The item's date or opening status prevents this action. Check the item details.",
  date_clarification_required:
    "Check the item's date details and complete the required date checks before continuing.",
  validation_error:
    "Some details are missing or invalid. Check the form and try again.",
  ineligible_item:
    "Check the item details, photos and donation requirements before continuing.",
  outside_reception_window:
    "You can receive these items only during the appointment's drop-off window.",
  invalid_qr:
    "This QR code is not valid. Ask the donor to open the QR code for this appointment.",
  photo_limit_reached: "This donation already has the maximum of three photos.",
  upload_too_large: `Choose a photo up to ${MAX_PHOTO_SIZE_LABEL} and 20 megapixels.`,
  unsupported_media_type:
    "This photo cannot be read. Choose a valid JPEG, PNG or WebP file.",
  photo_integrity_error: "This photo could not be read. Try loading it again.",
  stale_cursor: "These results have changed. Refresh the list.",
  invalid_cursor: "The next results could not be loaded. Refresh the list.",
  cursor_unavailable:
    "More results are unavailable right now. Try again later.",
  authentication_unavailable:
    "Dono cannot check your sign-in right now. Try again later.",
  qr_unavailable:
    "The appointment's QR code is unavailable right now. Try again later.",
  invalid_location:
    "Enter an address or town with at least 3 characters, or a full 5-digit postcode, such as 68100. Start with a letter or number.",
  geocoding_unavailable:
    "Dono could not look up this location. Check the address or postcode, or try again later.",
  provider_unavailable:
    "Automatic analysis is unavailable. Try again later or enter the details manually.",
  provider_timeout:
    "Automatic analysis took too long. Try again or enter the details manually.",
  provider_invalid_output:
    "Automatic analysis could not return usable details. Try again or enter the details manually.",
  database_unavailable:
    "Dono could not complete this request. Check the current status before trying again.",
  internal_error:
    "Dono could not complete this request. Check the current status before trying again.",
};

/** Keep server codes for recovery logic; show instructions instead of internal errors. */
export function apiErrorMessage(code: string, status: number): string {
  if (Object.hasOwn(messages, code)) return messages[code];
  if (status === 401) return messages.unauthenticated;
  if (status === 403) return messages.forbidden;
  if (status === 404) return messages.not_found;
  if (status === 429)
    return "Too many attempts. Wait a moment before trying again.";
  return "Dono could not complete this request. Check the current status before trying again.";
}
