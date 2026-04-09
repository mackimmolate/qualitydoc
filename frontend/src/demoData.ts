import type { CatalogItem, DocumentStatus, Settings } from './types'

export type StoredCatalogItem = Omit<
  CatalogItem,
  'coverage_count' | 'missing' | 'needs_owner_count' | 'due_soon_count' | 'overdue_count'
>

export type StoredDocument = {
  id: number
  catalog_item_id: number | null
  custom_title: string | null
  owner: string | null
  status: DocumentStatus
  storage_link: string | null
  last_review_date: string | null
  next_review_date: string | null
  review_frequency_months: number | null
  notes: string | null
  tags: string[]
  updated_at: string
}

export type DemoState = {
  settings: Settings
  catalog: StoredCatalogItem[]
  documents: StoredDocument[]
  next_document_id: number
}

function isoFromToday(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export function createDemoState(): DemoState {
  const catalog: StoredCatalogItem[] = [
    {
      id: 1,
      code: 'GOV-001',
      title: 'Information Security Policy',
      area: 'Governance',
      description_en: 'Core policy that defines the security direction, scope, and commitment.',
      description_sv: 'Grundpolicy som beskriver riktning, omfattning och ansvar for informationssakerhet.',
      required: true,
      active: true,
      default_owner_role: 'Security lead',
      review_frequency_months: 12,
      tisax_tags: ['policy', 'governance'],
    },
    {
      id: 2,
      code: 'GOV-003',
      title: 'Risk Assessment Method',
      area: 'Governance',
      description_en: 'Method and criteria used to identify, evaluate, and treat information security risks.',
      description_sv: 'Metod och kriterier for att identifiera, vardera och behandla risker.',
      required: true,
      active: true,
      default_owner_role: 'Risk owner',
      review_frequency_months: 12,
      tisax_tags: ['risk', 'method'],
    },
    {
      id: 3,
      code: 'ASM-001',
      title: 'Asset Inventory',
      area: 'Asset Management',
      description_en: 'Inventory of critical information, systems, and devices within scope.',
      description_sv: 'Inventering av kritisk information, system och enheter inom scope.',
      required: true,
      active: true,
      default_owner_role: 'IT manager',
      review_frequency_months: 6,
      tisax_tags: ['assets', 'inventory'],
    },
    {
      id: 4,
      code: 'ACC-001',
      title: 'Access Control Policy',
      area: 'Access Management',
      description_en: 'Rules for provisioning, approval, and periodic review of access rights.',
      description_sv: 'Regler for provisionering, godkannande och periodisk granskning av behorigheter.',
      required: true,
      active: true,
      default_owner_role: 'IT manager',
      review_frequency_months: 12,
      tisax_tags: ['access', 'policy'],
    },
    {
      id: 5,
      code: 'OPS-002',
      title: 'Backup and Restore Procedure',
      area: 'Operations',
      description_en: 'Documents backup frequency, retention, protection, and restore testing.',
      description_sv: 'Dokumenterar backupfrekvens, retention, skydd och tester av aterlasning.',
      required: true,
      active: true,
      default_owner_role: 'IT operations',
      review_frequency_months: 6,
      tisax_tags: ['backup', 'restore'],
    },
    {
      id: 6,
      code: 'INC-001',
      title: 'Incident Response Procedure',
      area: 'Incident Management',
      description_en: 'Defines classification, escalation, communication, and post-incident review.',
      description_sv: 'Definierar klassning, eskalering, kommunikation och efteranalys av incidenter.',
      required: true,
      active: true,
      default_owner_role: 'Incident manager',
      review_frequency_months: 12,
      tisax_tags: ['incident', 'response'],
    },
    {
      id: 7,
      code: 'BCM-001',
      title: 'Business Continuity Plan',
      area: 'Continuity',
      description_en: 'Plan for maintaining critical operations during disruption.',
      description_sv: 'Plan for att uppratthalla kritiska processer vid storningar.',
      required: true,
      active: true,
      default_owner_role: 'Operations manager',
      review_frequency_months: 12,
      tisax_tags: ['continuity', 'bcp'],
    },
    {
      id: 8,
      code: 'SUP-001',
      title: 'Supplier Security Assessment',
      area: 'Supplier Management',
      description_en: 'Evaluation of suppliers that access, process, or host scoped information.',
      description_sv: 'Bedomning av leverantorer som far tillgang till scoped information.',
      required: true,
      active: true,
      default_owner_role: 'Procurement',
      review_frequency_months: 12,
      tisax_tags: ['supplier', 'assessment'],
    },
    {
      id: 9,
      code: 'HR-001',
      title: 'Security Awareness Training Record',
      area: 'Human Resources',
      description_en: 'Tracks onboarding and periodic security awareness completion.',
      description_sv: 'Sparar introduktions- och aterkommande sakerhetsutbildning.',
      required: true,
      active: true,
      default_owner_role: 'HR',
      review_frequency_months: 12,
      tisax_tags: ['training', 'hr'],
    },
    {
      id: 10,
      code: 'DAT-002',
      title: 'Encryption Standard',
      area: 'Data Protection',
      description_en: 'Standard for encryption in transit, at rest, and key handling.',
      description_sv: 'Standard for kryptering under overforing, lagring och nyckelhantering.',
      required: true,
      active: true,
      default_owner_role: 'Security architect',
      review_frequency_months: 12,
      tisax_tags: ['encryption', 'data'],
    },
  ]

  const documents: StoredDocument[] = [
    {
      id: 1,
      catalog_item_id: 1,
      custom_title: null,
      owner: 'Marcus',
      status: 'active',
      storage_link: 'https://example.com/information-security-policy',
      last_review_date: isoFromToday(-20),
      next_review_date: isoFromToday(340),
      review_frequency_months: null,
      notes: 'Main policy record used for leadership review and audit interviews.',
      tags: ['policy', 'approved'],
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      catalog_item_id: 2,
      custom_title: 'Risk assessment workbook',
      owner: null,
      status: 'review',
      storage_link: 'https://example.com/risk-assessment',
      last_review_date: isoFromToday(-360),
      next_review_date: isoFromToday(7),
      review_frequency_months: 12,
      notes: 'Deliberately left without owner so the dashboard shows the gap.',
      tags: ['risk', 'workshop'],
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      catalog_item_id: 5,
      custom_title: null,
      owner: 'Infrastructure',
      status: 'active',
      storage_link: 'https://example.com/backup-restore',
      last_review_date: isoFromToday(-220),
      next_review_date: isoFromToday(-3),
      review_frequency_months: 6,
      notes: 'Marked overdue on purpose so the Pages demo shows review pressure.',
      tags: ['backup', 'evidence'],
      updated_at: new Date().toISOString(),
    },
    {
      id: 4,
      catalog_item_id: 8,
      custom_title: null,
      owner: 'Procurement',
      status: 'active',
      storage_link: 'https://example.com/supplier-security',
      last_review_date: isoFromToday(-120),
      next_review_date: isoFromToday(24),
      review_frequency_months: 12,
      notes: 'Shows a healthy but soon-to-be-reviewed supplier evidence record.',
      tags: ['supplier'],
      updated_at: new Date().toISOString(),
    },
    {
      id: 5,
      catalog_item_id: 9,
      custom_title: 'Training evidence archive',
      owner: 'HR',
      status: 'archived',
      storage_link: null,
      last_review_date: isoFromToday(-30),
      next_review_date: null,
      review_frequency_months: null,
      notes: 'Archived item to show how hidden-from-coverage records behave.',
      tags: ['archive'],
      updated_at: new Date().toISOString(),
    },
  ]

  return {
    settings: {
      workspace_name: 'QualityDoc Demo',
      notification_enabled: false,
      due_soon_days: 30,
      document_root_path: null,
      library_last_scanned_at: null,
    },
    catalog,
    documents,
    next_document_id: 6,
  }
}
