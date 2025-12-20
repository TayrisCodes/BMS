import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import type { InvoiceItem } from './invoices';

const INVOICE_TEMPLATES_COLLECTION_NAME = 'invoiceTemplates';

export interface InvoiceTemplate {
  _id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  defaultItems: InvoiceItem[];
  defaultVATRate?: number | null;
  headerText?: string | null;
  footerText?: string | null;
  customFields?: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getInvoiceTemplatesCollection(): Promise<Collection<InvoiceTemplate>> {
  const db = await getDb();
  return db.collection<InvoiceTemplate>(INVOICE_TEMPLATES_COLLECTION_NAME);
}

export async function ensureInvoiceTemplateIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(INVOICE_TEMPLATES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and isDefault
    {
      key: { organizationId: 1, isDefault: 1 },
      name: 'org_isDefault',
    },
    // Index on organizationId
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreateInvoiceTemplateInput {
  organizationId: string;
  name: string;
  description?: string | null;
  defaultItems: InvoiceItem[];
  defaultVATRate?: number | null;
  headerText?: string | null;
  footerText?: string | null;
  customFields?: Record<string, unknown> | null;
  isDefault?: boolean;
}

export async function createInvoiceTemplate(
  input: CreateInvoiceTemplateInput,
): Promise<InvoiceTemplate> {
  const collection = await getInvoiceTemplatesCollection();
  const now = new Date();

  // If this template is set as default, unset other defaults for this organization
  if (input.isDefault) {
    await collection.updateMany(
      { organizationId: input.organizationId, isDefault: true } as Document,
      { $set: { isDefault: false } } as Document,
    );
  }

  // Validate items
  if (!input.defaultItems || input.defaultItems.length === 0) {
    throw new Error('Template must have at least one default item');
  }

  const doc: Omit<InvoiceTemplate, '_id'> = {
    organizationId: input.organizationId,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    defaultItems: input.defaultItems,
    defaultVATRate: input.defaultVATRate ?? 15,
    headerText: input.headerText?.trim() ?? null,
    footerText: input.footerText?.trim() ?? null,
    customFields: input.customFields ?? null,
    isDefault: input.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<InvoiceTemplate>);

  return {
    ...(doc as InvoiceTemplate),
    _id: result.insertedId.toString(),
  } as InvoiceTemplate;
}

export async function findInvoiceTemplateById(
  templateId: string,
  organizationId?: string,
): Promise<InvoiceTemplate | null> {
  const collection = await getInvoiceTemplatesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(templateId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function listInvoiceTemplates(
  organizationId: string,
  includeDefaultOnly?: boolean,
): Promise<InvoiceTemplate[]> {
  const collection = await getInvoiceTemplatesCollection();

  const query: Record<string, unknown> = { organizationId };
  if (includeDefaultOnly) {
    query.isDefault = true;
  }

  return collection
    .find(query as Document)
    .sort({ isDefault: -1, createdAt: -1 })
    .toArray();
}

export async function getDefaultInvoiceTemplate(
  organizationId: string,
): Promise<InvoiceTemplate | null> {
  const templates = await listInvoiceTemplates(organizationId, true);
  return templates.length > 0 ? templates[0] : null;
}

export interface UpdateInvoiceTemplateInput {
  name?: string;
  description?: string | null;
  defaultItems?: InvoiceItem[];
  defaultVATRate?: number | null;
  headerText?: string | null;
  footerText?: string | null;
  customFields?: Record<string, unknown> | null;
  isDefault?: boolean;
}

export async function updateInvoiceTemplate(
  templateId: string,
  input: UpdateInvoiceTemplateInput,
  organizationId?: string,
): Promise<InvoiceTemplate | null> {
  const collection = await getInvoiceTemplatesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingTemplate = await findInvoiceTemplateById(templateId, organizationId);
    if (!existingTemplate) {
      return null;
    }

    // If setting as default, unset other defaults for this organization
    if (input.isDefault) {
      await collection.updateMany(
        { organizationId: existingTemplate.organizationId, isDefault: true } as Document,
        { $set: { isDefault: false } } as Document,
      );
    }

    const updateDoc: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateDoc.name = input.name.trim();
    }
    if (input.description !== undefined) {
      updateDoc.description = input.description?.trim() ?? null;
    }
    if (input.defaultItems !== undefined) {
      if (input.defaultItems.length === 0) {
        throw new Error('Template must have at least one default item');
      }
      updateDoc.defaultItems = input.defaultItems;
    }
    if (input.defaultVATRate !== undefined) {
      updateDoc.defaultVATRate = input.defaultVATRate;
    }
    if (input.headerText !== undefined) {
      updateDoc.headerText = input.headerText?.trim() ?? null;
    }
    if (input.footerText !== undefined) {
      updateDoc.footerText = input.footerText?.trim() ?? null;
    }
    if (input.customFields !== undefined) {
      updateDoc.customFields = input.customFields;
    }
    if (input.isDefault !== undefined) {
      updateDoc.isDefault = input.isDefault;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(templateId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as InvoiceTemplate | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteInvoiceTemplate(
  templateId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getInvoiceTemplatesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingTemplate = await findInvoiceTemplateById(templateId, organizationId);
    if (!existingTemplate) {
      return false;
    }

    const result = await collection.deleteOne({ _id: new ObjectId(templateId) } as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}

/**
 * Applies a template to create invoice items and default values.
 * Supports template variables like {{tenantName}}, {{buildingName}}, etc.
 */
export interface ApplyTemplateResult {
  items: InvoiceItem[];
  vatRate: number;
  headerText?: string | null;
  footerText?: string | null;
  customFields?: Record<string, unknown> | null;
}

export function applyInvoiceTemplate(
  template: InvoiceTemplate,
  variables?: Record<string, string>,
): ApplyTemplateResult {
  // Replace template variables in items
  const items = template.defaultItems.map((item) => ({
    ...item,
    description: replaceTemplateVariables(item.description, variables),
  }));

  // Replace template variables in header and footer text
  const headerText = template.headerText
    ? replaceTemplateVariables(template.headerText, variables)
    : null;
  const footerText = template.footerText
    ? replaceTemplateVariables(template.footerText, variables)
    : null;

  return {
    items,
    vatRate: template.defaultVATRate ?? 15,
    headerText,
    footerText,
    customFields: template.customFields,
  };
}

/**
 * Replaces template variables in text.
 * Variables are in the format {{variableName}}.
 */
function replaceTemplateVariables(text: string, variables?: Record<string, string>): string {
  if (!variables) {
    return text;
  }

  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

