import { query } from '@/lib/db.js';
import {
  generateUniqueDocumentId,
  substitutePlaceholders,
  generateVerificationToken,
  generateVerificationHash,
  formatDocumentWithBranding,
  logDocumentGeneration,
} from '@/lib/document-generation.js';

export async function seedDocumentTemplates() {
  try {
    // Idempotent: if the templates already exist we still UPDATE the
    // internship template body so re-running picks up copy changes.
    // (The previous behaviour returned early, which meant the new
    // user-supplied internship letter could never replace an older seed.)
    const existing = await query(
      `SELECT id FROM document_templates WHERE name = 'Internship Acceptance Letter' LIMIT 1`
    );
    const internshipAlreadySeeded = existing.rows.length > 0;

    // Template 1: Internship Acceptance Letter — formal letter from the
    // organisation to the introducing institution accepting the placement.
    // Uses {{placeholders}} so the same template handles any applicant.
    // Company name / email / address / phone come from /app/settings/company
    // via getActiveBranding(); only the applicant-specific fields need to
    // be filled at generation time.
    const internshipTemplate = `
<p style="margin-bottom: 20px;">{{issue_date}}</p>

<p style="margin-bottom: 20px;">Dear Sir/Madam,</p>

<p style="margin-bottom: 20px;"><strong>RE: INTERNSHIP PLACEMENT ACCEPTANCE FOR {{applicant_name_upper}}</strong></p>

<p style="margin-bottom: 20px;">Greetings from {{organization_name}}.</p>

<p style="margin-bottom: 20px;">
  We acknowledge receipt of your letter introducing Mr./Ms. {{applicant_name}}
  (Reg No. {{registration_number}}), a student pursuing a {{course_of_study}}.
</p>

<p style="margin-bottom: 20px;">
  We are pleased to inform you that {{organization_name}} is willing to offer
  him/her internship placement within our organization for the proposed
  training period from {{training_period}}.
</p>

<p style="margin-bottom: 20px;">
  During the internship period, he/she will be exposed to practical
  experiences related to {{exposure_areas}} relevant to his/her field of
  study.
</p>

<p style="margin-bottom: 20px;">
  We believe the training opportunity will help bridge the gap between
  theoretical learning and real-world technical practice.
</p>

<p style="margin-bottom: 30px;">
  We look forward to supporting his/her professional growth during the
  internship period.
</p>

<p style="margin-bottom: 20px;">Kind regards,</p>

<p style="margin-top: 40px;">
  <strong>{{organization_name}}</strong><br>
  Email: {{organization_email}}<br>
  {{organization_country}}
</p>
    `;

    const internshipVariables = JSON.stringify([
      'applicant_name',
      'applicant_name_upper',
      'registration_number',
      'course_of_study',
      'training_period',
      'exposure_areas',
      'issue_date',
      'organization_name',
      'organization_email',
      'organization_country',
    ]);

    if (internshipAlreadySeeded) {
      await query(
        `UPDATE document_templates
           SET description = $1, category = $2, body = $3, body_format = $4,
               variables = $5, updated_at = NOW()
         WHERE name = $6`,
        [
          'Official internship acceptance letter sent to the introducing institution',
          'internship',
          internshipTemplate,
          'html',
          internshipVariables,
          'Internship Acceptance Letter',
        ]
      );
    } else {
      await query(
        `INSERT INTO document_templates (
          name, description, category, body, body_format, variables, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'Internship Acceptance Letter',
          'Official internship acceptance letter sent to the introducing institution',
          'internship',
          internshipTemplate,
          'html',
          internshipVariables,
          null,
        ]
      );
    }

    // The remaining templates are only seeded on first run — re-runs are
    // a no-op for them. If you need to refresh their copy, extend the
    // pattern above (check existence, branch INSERT vs UPDATE).
    if (internshipAlreadySeeded) {
      return {
        success: true,
        message: 'Internship template refreshed; other templates already present',
        count: 1,
      };
    }

    // Template 2: Interview Invitation
    const interviewTemplate = `
<h2 style="color: #1F2937; text-align: center; margin-bottom: 30px;">
  INTERVIEW INVITATION
</h2>

<p style="margin-bottom: 20px;">
  <strong>{{applicant_name}}</strong><br>
  Email: {{applicant_email}}<br>
  Phone: {{applicant_phone}}
</p>

<p style="margin-bottom: 20px;">Dear {{applicant_name}},</p>

<p style="margin-bottom: 20px;">
  Congratulations! Your application has been shortlisted for an interview with our organization.
  We are impressed by your qualifications and would like to learn more about you.
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Interview Details:</h3>

<p style="margin-bottom: 20px;">
  <strong>Position:</strong> {{position_title}}<br>
  <strong>Date:</strong> {{interview_date}}<br>
  <strong>Time:</strong> {{interview_time}}<br>
  <strong>Location:</strong> {{interview_location}}<br>
  <strong>Duration:</strong> Approximately {{interview_duration}} minutes<br>
  <strong>Interviewer:</strong> {{interviewer_name}}
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">What to Bring:</h3>

<ul style="margin-bottom: 20px;">
  <li>Original identification documents</li>
  <li>Copies of relevant certificates and qualifications</li>
  <li>Any portfolio or work samples</li>
  <li>Completed application form</li>
</ul>

<p style="margin-bottom: 20px;">
  Please confirm your attendance by replying to this email within 48 hours.
  Should you be unable to attend on the scheduled date, please inform us as soon as possible.
</p>

<p style="margin-bottom: 20px;">
  We look forward to meeting with you.
</p>

<p style="margin-bottom: 20px;">
  Best regards,
</p>

<p style="margin-top: 50px;">
  {{hr_name}}<br>
  Human Resources Department<br>
  {{organization_name}}
</p>
    `;

    await query(
      `INSERT INTO document_templates (
        name, description, category, body, body_format, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Interview Invitation',
        'Formal interview invitation letter with date, time, and location',
        'employment',
        interviewTemplate,
        'html',
        JSON.stringify([
          'applicant_name',
          'applicant_email',
          'applicant_phone',
          'position_title',
          'interview_date',
          'interview_time',
          'interview_location',
          'interview_duration',
          'interviewer_name',
          'hr_name',
          'organization_name',
        ]),
        null,
      ]
    );

    // Template 3: Job Application Acknowledgement
    const ackTemplate = `
<h2 style="color: #1F2937; text-align: center; margin-bottom: 30px;">
  APPLICATION ACKNOWLEDGEMENT
</h2>

<p style="margin-bottom: 20px;">
  <strong>{{applicant_name}}</strong><br>
  Registration No: {{registration_number}}<br>
  Email: {{applicant_email}}
</p>

<p style="margin-bottom: 20px;">Dear {{applicant_name}},</p>

<p style="margin-bottom: 20px;">
  Thank you for submitting your application for the position of <strong>{{position_title}}</strong> with {{organization_name}}.
  We appreciate your interest in joining our organization.
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Application Reference:</h3>

<p style="margin-bottom: 20px;">
  <strong>Reference Number:</strong> {{application_reference}}<br>
  <strong>Submitted Date:</strong> {{submission_date}}<br>
  <strong>Expected Review Period:</strong> {{review_period}} days
</p>

<p style="margin-bottom: 20px;">
  We have received your application and it is currently under review. Our selection process involves multiple stages,
  and shortlisted candidates will be contacted for further evaluation.
</p>

<p style="margin-bottom: 20px;">
  We appreciate your patience and will keep you updated on the status of your application.
  If your profile matches our requirements, we will contact you directly.
</p>

<p style="margin-bottom: 20px;">
  Thank you for considering {{organization_name}} as your potential employer.
</p>

<p style="margin-bottom: 20px;">
  Best regards,
</p>

<p style="margin-top: 50px;">
  {{hr_name}}<br>
  Human Resources Department<br>
  {{organization_name}}
</p>
    `;

    await query(
      `INSERT INTO document_templates (
        name, description, category, body, body_format, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Application Acknowledgement',
        'Application receipt and processing confirmation letter',
        'employment',
        ackTemplate,
        'html',
        JSON.stringify([
          'applicant_name',
          'registration_number',
          'applicant_email',
          'position_title',
          'organization_name',
          'application_reference',
          'submission_date',
          'review_period',
          'hr_name',
        ]),
        null,
      ]
    );

    return {
      success: true,
      message: 'Templates seeded successfully',
      count: 3,
    };
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}

/**
 * Seed (or re-seed) the Mukungu Hatimu internship acceptance letter using
 * the canonical Consty copy. Idempotent: if a row already exists it is
 * updated in place so the same call can be used to refresh the copy when
 * the template changes.
 *
 * Company name / email / country are pulled from /app/settings/company so
 * the seeded document inherits whatever branding is currently configured.
 */
export async function seedMukunguHatimu() {
  try {
    // Get the internship template (seed templates if missing)
    let templateRes = await query(
      `SELECT id FROM document_templates WHERE name = 'Internship Acceptance Letter' LIMIT 1`
    );
    if (!templateRes.rows[0]) {
      await seedDocumentTemplates();
      templateRes = await query(
        `SELECT id FROM document_templates WHERE name = 'Internship Acceptance Letter' LIMIT 1`
      );
    }
    const templateId = templateRes.rows[0].id;

    // Pull company identity from /app/settings/company so the seed inherits
    // whatever the team has configured (name, email, country in address).
    let companyName = 'Consty';
    let companyEmail = 'info@consty.local';
    let companyCountry = 'Uganda';
    try {
      const settings = await query(
        `SELECT key, value FROM company_settings
         WHERE key IN ('company_name','company_email','company_address')`
      );
      for (const r of settings.rows) {
        if (r.key === 'company_name'    && r.value) companyName = r.value;
        if (r.key === 'company_email'   && r.value) companyEmail = r.value;
        if (r.key === 'company_address' && r.value) {
          // Country is the last comma-separated chunk if present, else the
          // whole address.
          const parts = String(r.value).split(',').map(s => s.trim()).filter(Boolean);
          companyCountry = parts[parts.length - 1] || r.value;
        }
      }
    } catch {/* company_settings may not be migrated yet */}

    const placeholderData = {
      applicant_name:       'Mukungu Hatimu',
      applicant_name_upper: 'MUKUNGU HATIMU',
      registration_number:  '24C/BIT/312/UMC',
      course_of_study:      'Bachelor of Information Technology',
      training_period:      'May to July 2026',
      exposure_areas:       'software systems operations, technical support, deployment environments, and organizational workflows',
      issue_date:           new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
      organization_name:    companyName,
      organization_email:   companyEmail,
      organization_country: companyCountry,
    };

    // Use the most recent active branding row if one exists, else NULL.
    const brandingRes = await query(
      `SELECT id FROM company_branding WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    ).catch(() => ({ rows: [] }));
    const brandingId = brandingRes.rows[0]?.id || null;

    // Idempotent: if we already have a row for this recipient, refresh the
    // placeholder_data and title so a re-seed picks up new copy.
    const existing = await query(
      `SELECT id, unique_id FROM generated_documents
       WHERE recipient_name = 'Mukungu Hatimu' AND document_type = 'internship_acceptance'
       ORDER BY created_at DESC LIMIT 1`
    );

    if (existing.rows[0]) {
      const r = await query(
        `UPDATE generated_documents
           SET placeholder_data = $1, title = $2, branding_id = $3,
               status = 'issued', is_revoked = FALSE, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          JSON.stringify(placeholderData),
          `Internship Acceptance Letter - Mukungu Hatimu`,
          brandingId,
          existing.rows[0].id,
        ]
      );
      return {
        success: true,
        message: 'Mukungu Hatimu internship acceptance letter refreshed',
        document_id: r.rows[0].unique_id,
        verification_url: `/verify/${r.rows[0].unique_id}`,
        refreshed: true,
      };
    }

    const uniqueId = await generateUniqueDocumentId('INT', query);
    const verificationToken = generateVerificationToken();
    const verificationHash = generateVerificationHash(uniqueId);

    const result = await query(
      `INSERT INTO generated_documents (
        template_id, branding_id, unique_id, title, document_type,
        recipient_name, recipient_email, recipient_phone,
        placeholder_data, verification_token, verification_hash,
        generated_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        templateId,
        brandingId,
        uniqueId,
        'Internship Acceptance Letter - Mukungu Hatimu',
        'internship_acceptance',
        'Mukungu Hatimu',
        null,
        null,
        JSON.stringify(placeholderData),
        verificationToken,
        verificationHash,
        null, // No specific user
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      ]
    );

    return {
      success: true,
      message: 'Mukungu Hatimu internship acceptance letter generated',
      document_id: result.rows[0].unique_id,
      verification_url: `/verify/${result.rows[0].unique_id}`,
    };
  } catch (error) {
    console.error('Mukungu seed error:', error);
    throw error;
  }
}
