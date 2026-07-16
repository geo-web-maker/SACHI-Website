// All mock data — for demoing the admin UI only. Real records come from
// MongoDB via FastAPI once the backend is connected.

export const initialContactSubmissions = [
  { id: 1, name: 'Moses Kato', email: 'moses.kato@example.com', subject: 'Partnership enquiry', message: "We're a school in Wakiso interested in a WASH programme partnership. Could someone reach out?", date: '2026-07-08', status: 'New' },
  { id: 2, name: 'Grace Namutebi', email: 'g.namutebi@example.com', subject: 'Volunteering', message: 'I am a nursing student and would love to volunteer with your nutrition programme this semester.', date: '2026-07-06', status: 'New' },
  { id: 3, name: 'Aid Uganda Trust', email: 'contact@aidugandatrust.org', subject: 'Funding collaboration', message: 'We represent a UK-based trust looking to co-fund WASH interventions in Nakawa Division.', date: '2026-07-02', status: 'Read' },
  { id: 4, name: 'Ronald Mugisha', email: 'ronald.m@example.com', subject: 'Media enquiry', message: 'Writing a feature on community health NGOs in Kampala — would like a short interview.', date: '2026-06-29', status: 'Read' },
];

export const initialDonations = [
  { id: 1, donor: 'Anonymous', amount: 150000, type: 'One-time', method: 'Mobile Money', date: '2026-07-10' },
  { id: 2, donor: 'Sarah Nalubega', amount: 50000, type: 'Monthly', method: 'Mobile Money', date: '2026-07-09' },
  { id: 3, donor: 'Kampala Rotary Club', amount: 2000000, type: 'One-time', method: 'Bank Transfer', date: '2026-07-05' },
  { id: 4, donor: 'Anonymous', amount: 20000, type: 'One-time', method: 'Mobile Money', date: '2026-07-04' },
  { id: 5, donor: 'James Okwir', amount: 50000, type: 'Monthly', method: 'Mobile Money', date: '2026-06-30' },
  { id: 6, donor: 'Anonymous', amount: 150000, type: 'One-time', method: 'Bank Transfer', date: '2026-06-25' },
];
