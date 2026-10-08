export const DEFAULT_DEPARTMENTS = [
  { name: 'Enquiry', order: 1, defaultSlaHours: 48 },
  { name: 'Measurement', order: 2, defaultSlaHours: 48 },
  { name: 'Design', order: 3, defaultSlaHours: 72 },
  { name: 'Purchase', order: 4, defaultSlaHours: 96 },
  { name: 'Manufacturing', order: 5, defaultSlaHours: 168 },
  { name: 'Assembly', order: 6, defaultSlaHours: 48 },
  { name: 'Delivery', order: 7, defaultSlaHours: 24 },
  { name: 'Final Clean & Handover', order: 8, defaultSlaHours: 24 },
] as const;

export const DEFAULT_STAGE_WEIGHTS: Record<string, number> = {
  Enquiry: 5,
  Measurement: 5,
  Design: 15,
  Purchase: 15,
  Manufacturing: 35,
  Assembly: 10,
  Delivery: 10,
  'Final Clean & Handover': 5,
};
