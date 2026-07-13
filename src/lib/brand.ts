// Central brand identity for Novain Escrowdesk / Declutter.
export const BRAND = {
  parent: "Novain",
  core: "Novain Escrowdesk",
  coreShort: "Escrowdesk",
  marketplace: "Declutter",
  marketplaceFull: "Declutter by Novain",
  tagline: "Secure Every Transaction.",
  rootDomain: "escrowdesk.nexorian.shop",
} as const;

export const ESCROW_DEAL_TYPES = [
  { value: "marketplace",    label: "Marketplace Escrow",     desc: "Trades that originate on Declutter." },
  { value: "product",        label: "Product Escrow",         desc: "Physical goods between buyer and seller." },
  { value: "service",        label: "Service Escrow",         desc: "Delivered services with acceptance criteria." },
  { value: "vehicle",        label: "Vehicle Escrow",         desc: "Cars, bikes, boats, trucks." },
  { value: "property",       label: "Property Escrow",        desc: "Real estate purchase, lease deposits." },
  { value: "freelance",      label: "Freelance Escrow",       desc: "Contract work with deliverables." },
  { value: "invoice",        label: "Invoice Escrow",         desc: "Third-party held payment of an invoice." },
  { value: "business",       label: "Business Escrow",        desc: "Acquisitions, share transfers, buyouts." },
  { value: "import_export",  label: "Import / Export Escrow", desc: "Cross-border trade with proof of shipment." },
  { value: "construction",   label: "Construction Escrow",    desc: "Contractor payments tied to inspections." },
  { value: "milestone",      label: "Milestone Escrow",       desc: "Multi-stage releases against milestones." },
  { value: "digital_product",label: "Digital Product Escrow", desc: "Digital goods, licenses, downloads." },
  { value: "domain",         label: "Domain Escrow",          desc: "Domain-name transfers between parties." },
  { value: "website",        label: "Website Escrow",         desc: "Website sale with handover verification." },
  { value: "software",       label: "Software Escrow",        desc: "Source-code deposits and IP handover." },
  { value: "crypto",         label: "Crypto Escrow",          desc: "Custom crypto-for-fiat or crypto-for-goods." },
  { value: "equipment",      label: "Equipment Escrow",       desc: "Machinery, heavy or specialised equipment." },
  { value: "trade",          label: "Trade Escrow",           desc: "Wholesale or dealer-to-dealer trades." },
  { value: "investment",     label: "Investment Escrow",      desc: "Capital calls or subscription escrow." },
  { value: "custom",         label: "Custom Escrow",          desc: "Any arrangement not listed above." },
] as const;

export type EscrowDealType = (typeof ESCROW_DEAL_TYPES)[number]["value"];
