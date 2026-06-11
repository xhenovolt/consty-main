/**
 * Validation Schemas
 * Input validation for authentication and authorization
 */

import { z } from 'zod';

/**
 * Login request validation
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register request validation
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Full name is required').max(255, 'Name is too long'),
});

/**
 * Asset creation/update validation
 */
export const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  acquisition_source: z.string().max(255).optional().or(z.literal(null)),
  acquisition_date: z.string().date().optional().or(z.literal(null)),
  acquisition_cost: z.coerce.number().nonnegative().optional().or(z.literal(null)),
  current_value: z.coerce.number().nonnegative('Current value must be non-negative'),
  depreciation_rate: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().optional().or(z.literal(null)),
});

/**
 * Liability creation/update validation
 */
export const liabilitySchema = z.object({
  name: z.string().min(1, 'Liability name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  creditor: z.string().max(255).optional().or(z.literal(null)),
  principal_amount: z.coerce.number().nonnegative('Principal amount must be non-negative'),
  outstanding_amount: z.coerce.number().nonnegative('Outstanding amount must be non-negative'),
  interest_rate: z.coerce.number().min(0).max(100).optional().default(0),
  due_date: z.string().date().optional().or(z.literal(null)),
  status: z.enum(['ACTIVE', 'CLEARED', 'DEFAULTED', 'DEFERRED']).default('ACTIVE'),
  notes: z.string().optional().or(z.literal(null)),
});

/**
 * Deal creation/update validation
 * Founder-First: Requires system_id and either prospect_id or client_id
 */
export const dealSchema = z.object({
  title: z.string().min(1, 'Deal title is required').max(255),
  client_name: z.string().max(255).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  value_estimate: z.coerce.number().nonnegative('Value estimate must be non-negative').optional().default(0),
  stage: z.enum(['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost']).default('Qualification'),
  probability: z.coerce.number().min(0).max(100).optional().default(50),
  system_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  prospect_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  client_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  assigned_to: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  expected_close_date: z.string().date().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).default('ACTIVE'),
});

/**
 * Validate deal input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateDeal(data) {
  try {
    const validated = dealSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate deal stage change
 * @param {string} newStage - New stage value
 * @returns {boolean} Whether stage is valid
 */
export function isValidDealStage(newStage) {
  const validStages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  return validStages.includes(newStage);
}

/**
 * Validate deal probability
 * @param {number} probability - Probability value (0-100)
 * @returns {boolean} Whether probability is valid
 */
export function isValidDealProbability(probability) {
  return typeof probability === 'number' && probability >= 0 && probability <= 100;
}


/**
 * Validate login input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateLogin(data) {
  try {
    const validated = loginSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate register input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateRegister(data) {
  try {
    const validated = registerSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate asset input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateAsset(data) {
  try {
    const validated = assetSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

/**
 * Validate liability input
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result { success, data, errors }
 */
export function validateLiability(data) {
  try {
    const validated = liabilitySchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.flatten().fieldErrors,
      };
    }
    return {
      success: false,
      data: null,
      errors: { general: ['Validation failed'] },
    };
  }
}

export default {
  loginSchema,
  registerSchema,
  assetSchema,
  liabilitySchema,
  dealSchema,
  validateLogin,
  validateRegister,
  validateAsset,
  validateLiability,
  validateDeal,
  isValidDealStage,
  isValidDealProbability,
};

// ============================================================================
// FOUNDER-FIRST VALIDATION SCHEMAS
// ============================================================================

/**
 * Client creation validation (converted from prospect)
 */
export const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  company_name: z.string().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  prospect_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  status: z.enum(['active', 'inactive', 'churned']).default('active'),
  notes: z.string().optional().or(z.literal('')),
});

export function validateClient(data) {
  try {
    const validated = clientSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Contract creation validation
 */
export const contractSchema = z.object({
  client_id: z.string().uuid('Client ID is required'),
  system_id: z.string().uuid('System ID is required'),
  deal_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  installation_fee: z.coerce.number().nonnegative().optional().default(0),
  recurring_enabled: z.boolean().optional().default(false),
  recurring_cycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  recurring_amount: z.coerce.number().nonnegative().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  installation_date: z.string().date().optional(),
  terms: z.string().max(5000).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'completed', 'terminated', 'expired']).default('active'),
});

export function validateContract(data) {
  try {
    const validated = contractSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Payment creation validation
 */
export const paymentSchema = z.object({
  contract_id: z.string().uuid('Contract ID is required'),
  amount_received: z.coerce.number().positive('Amount must be greater than 0'),
  date_received: z.string().datetime().optional(),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'check', 'card', 'crypto', 'other']).default('bank_transfer'),
  reference_number: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export function validatePayment(data) {
  try {
    const validated = paymentSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Allocation validation (where money goes)
 */
export const allocationSchema = z.object({
  payment_id: z.string().uuid('Payment ID is required'),
  allocation_type: z.enum(['expense', 'vault', 'operating', 'investment', 'dividend', 'custom']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category_id: z.coerce.number().optional(),
  custom_category: z.string().max(100).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
});

export function validateAllocation(data) {
  try {
    const validated = allocationSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Expense validation
 */
export const expenseSchema = z.object({
  category_id: z.coerce.number().optional(),
  custom_category: z.string().max(100).optional().or(z.literal('')),
  description: z.string().min(1, 'Description is required').max(1000),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expense_date: z.string().date().optional(),
  allocation_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  status: z.enum(['recorded', 'approved', 'disputed']).default('recorded'),
});

export function validateExpense(data) {
  try {
    const validated = expenseSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Prospect validation
 */
export const prospectSchema = z.object({
  prospect_name: z.string().min(1, 'Prospect name is required').max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone_number: z.string().max(50).optional().or(z.literal('')),
  whatsapp_number: z.string().max(50).optional().or(z.literal('')),
  company_name: z.string().max(255).optional().or(z.literal('')),
  industry_id: z.coerce.number().optional(),
  city: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  source_id: z.coerce.number().optional(),
  current_stage_id: z.coerce.number().optional().default(1),
  assigned_sales_agent_id: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  notes: z.string().max(5000).optional().or(z.literal('')),
  next_followup_at: z.string().datetime().optional().or(z.literal('')),
  status: z.enum(['active', 'archived', 'converted', 'disqualified']).default('active'),
});

export function validateProspect(data) {
  try {
    const validated = prospectSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}

/**
 * Prospect activity validation
 */
export const prospectActivitySchema = z.object({
  prospect_id: z.string().uuid('Prospect ID is required'),
  activity_type: z.enum(['call', 'email', 'meeting', 'message', 'note', 'stage_change', 'follow_up_set', 'deal_created', 'converted']),
  subject: z.string().max(255).optional().or(z.literal('')),
  description: z.string().max(5000).optional().or(z.literal('')),
  outcome: z.string().max(255).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  next_followup_date: z.string().date().optional().or(z.literal('')),
  duration_minutes: z.coerce.number().nonnegative().optional(),
});

export function validateProspectActivity(data) {
  try {
    const validated = prospectActivitySchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, data: null, errors: error.flatten().fieldErrors };
    }
    return { success: false, data: null, errors: { general: ['Validation failed'] } };
  }
}