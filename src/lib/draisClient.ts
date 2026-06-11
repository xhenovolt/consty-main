/**
 * DRAIS API Client
 * Centralized client for all DRAIS API interactions
 * 
 * SECURITY NOTES:
 * - This client runs on the backend (server-side)
 * - Never expose API keys in frontend code
 * - Use proxy routes in /api/drais/* for frontend access
 * - All sensitive operations validated through Consty auth layer
 */

const BASE_URL = process.env.DRAIS_API_BASE_URL || 'https://drais-api.example.com';
const API_KEY = process.env.DRAIS_API_KEY || '';
const API_SECRET = process.env.DRAIS_API_SECRET || '';

interface DRAISSchool {
  id: string;
  external_id: string;
  name: string;
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
  last_activity?: string;
  subscription_plan?: string;
  monthly_price?: number;
}

interface DRAISAuditLog {
  id: string;
  school_id: string;
  school_name: string;
  action: string;
  user_id?: string;
  user_email?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface DRAISResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Build headers for DRAIS API requests
 */
function buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'x-api-secret': API_SECRET,
    ...additionalHeaders,
  };
}

/**
 * Generic API request handler with error management
 */
async function makeRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, any>,
  headers?: Record<string, string>
): Promise<DRAISResponse<T>> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: buildHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle non-200 responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`DRAIS API Error [${response.status}] ${endpoint}:`, errorData);
      
      return {
        success: false,
        error: errorData?.message || errorData?.error || `HTTP ${response.status}`,
      };
    }

    const data: T = await response.json();
    return {
      success: true,
      data,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`DRAIS API Connection Error [${endpoint}]:`, errorMessage);
    
    return {
      success: false,
      error: `Connection failed: ${errorMessage}`,
    };
  }
}

/**
 * SCHOOL MANAGEMENT ENDPOINTS
 */

/**
 * Get all schools from DRAIS
 */
export async function getSchools(): Promise<DRAISResponse<DRAISSchool[]>> {
  return makeRequest<DRAISSchool[]>(
    'GET',
    '/api/external/schools'
  );
}

/**
 * Get a specific school by ID
 */
export async function getSchoolById(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  return makeRequest<DRAISSchool>(
    'GET',
    `/api/external/schools/${schoolId}`
  );
}

/**
 * Update school information
 */
export async function updateSchool(
  schoolId: string,
  payload: Partial<DRAISSchool>
): Promise<DRAISResponse<DRAISSchool>> {
  return makeRequest<DRAISSchool>(
    'PATCH',
    `/api/external/schools/${schoolId}`,
    payload as Record<string, any>
  );
}

/**
 * Suspend a school
 */
export async function suspendSchool(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  return makeRequest<DRAISSchool>(
    'POST',
    `/api/external/schools/${schoolId}/suspend`
  );
}

/**
 * Activate a school
 */
export async function activateSchool(schoolId: string): Promise<DRAISResponse<DRAISSchool>> {
  return makeRequest<DRAISSchool>(
    'POST',
    `/api/external/schools/${schoolId}/activate`
  );
}

/**
 * PRICING ENDPOINTS
 */

/**
 * Update school pricing (subscription plan and price)
 */
export async function updateSchoolPricing(
  schoolId: string,
  pricing: {
    subscription_plan: string;
    monthly_price: number;
  }
): Promise<DRAISResponse<DRAISSchool>> {
  return makeRequest<DRAISSchool>(
    'PATCH',
    `/api/external/schools/${schoolId}`,
    pricing
  );
}

/**
 * ACTIVITY MONITORING ENDPOINTS
 */

interface AuditLogsQuery {
  school_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get audit logs from DRAIS
 * Supports filtering by date range and school
 */
export async function getAuditLogs(
  query?: AuditLogsQuery
): Promise<DRAISResponse<DRAISAuditLog[]>> {
  const params = new URLSearchParams();
  if (query?.school_id) params.append('school_id', query.school_id);
  if (query?.start_date) params.append('start_date', query.start_date);
  if (query?.end_date) params.append('end_date', query.end_date);
  if (query?.limit) params.append('limit', String(query.limit));
  if (query?.offset) params.append('offset', String(query.offset));

  const endpoint = `/api/external/audit-logs${params.size > 0 ? `?${params}` : ''}`;
  return makeRequest<DRAISAuditLog[]>('GET', endpoint);
}

/**
 * HEALTH CHECK & CONNECTIVITY
 */

/**
 * Verify DRAIS API is accessible and credentials are valid
 */
export async function healthCheck(): Promise<DRAISResponse<{ status: string }>> {
  return makeRequest<{ status: string }>(
    'GET',
    '/api/external/health'
  );
}

/**
 * Type exports for frontend use
 */
export type { DRAISSchool, DRAISAuditLog, DRAISResponse };
