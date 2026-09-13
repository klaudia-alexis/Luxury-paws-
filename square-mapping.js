// Maps Luxury Paws' internal staff ids to the Team Member / Location / Service
// records you create inside Square Sandbox. Fill in the matching env vars —
// see README.md → "Square Sandbox setup" for exactly where each id comes from.
//
// Why a single "default" service variation? Square expects every booking to
// reference one bookable Catalog service. Rather than recreating all ~110
// Luxury Paws breed/service combinations as separate Square catalog items,
// this uses one generic "Dog Grooming Appointment" service in Square and
// passes the real service name, breed and price through as the booking's
// customer_note instead. Duration is still set per-booking. If you'd rather
// have Square's own catalog mirror every service/breed exactly, that's a
// bigger follow-up job — flag it and we can scope that separately.
module.exports = {
  locationId: process.env.SQUARE_LOCATION_ID,
  defaultServiceVariationId: process.env.SQUARE_SERVICE_VARIATION_ID,
  staffTeamMemberIds: {
    klaudia: process.env.SQUARE_TEAM_MEMBER_KLAUDIA,
    monika: process.env.SQUARE_TEAM_MEMBER_MONIKA,
    leah: process.env.SQUARE_TEAM_MEMBER_LEAH,
    // "Any Available Groomer" falls back to Klaudia's calendar in Square.
    // Change this if you'd rather it default to someone else.
    any: process.env.SQUARE_TEAM_MEMBER_KLAUDIA,
  },
};
