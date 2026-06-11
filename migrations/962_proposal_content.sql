-- ================================================================
-- MIGRATION 962: PROPOSAL ENGINE — DEEP CONTENT + MULTI-PLAN
-- ================================================================
-- Phase 2: systems_extended_content + comparison_matrix
-- Phase 3: proposals.selected_plan_ids[], recommended_plan_id
-- Phase 5: Cost-of-inaction + full DRAIS intelligence content
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Extended narrative content per system
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS systems_extended_content (
  system_id              UUID PRIMARY KEY REFERENCES drais_systems(id) ON DELETE CASCADE,
  problem_block          TEXT NOT NULL DEFAULT '',
  solution_block         TEXT NOT NULL DEFAULT '',
  why_attendance_first   TEXT NOT NULL DEFAULT '',
  cost_of_inaction_block TEXT NOT NULL DEFAULT '',
  transformation_block   TEXT NOT NULL DEFAULT '',
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. Comparison matrix JSONB on drais_systems
--    Array of { label, category, <plan_id>: value, ... }
-- ----------------------------------------------------------------
ALTER TABLE drais_systems
  ADD COLUMN IF NOT EXISTS comparison_matrix JSONB;

-- ----------------------------------------------------------------
-- 3. Multi-plan columns on proposals
-- ----------------------------------------------------------------
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS selected_plan_ids   UUID[],
  ADD COLUMN IF NOT EXISTS recommended_plan_id UUID REFERENCES pricing_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_count       INTEGER,
  ADD COLUMN IF NOT EXISTS school_type         VARCHAR(50);

-- ----------------------------------------------------------------
-- 4. Backfill existing proposals
-- ----------------------------------------------------------------
UPDATE proposals
SET  selected_plan_ids   = ARRAY[selected_plan_id],
     recommended_plan_id = selected_plan_id
WHERE selected_plan_ids IS NULL;

-- ----------------------------------------------------------------
-- 5. Seed DRAIS extended content
-- ----------------------------------------------------------------
INSERT INTO systems_extended_content (
  system_id, problem_block, solution_block, why_attendance_first,
  cost_of_inaction_block, transformation_block
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',

  $prob$Most schools in Uganda and across East Africa still rely on manual attendance registers — paper that can be lost, forged, or filled in retrospectively. The consequence is invisible: no one truly knows who is in school right now, and decisions are made on assumptions rather than facts.

This creates compounding problems every single day:

• Students can skip school without parents knowing for days or even weeks. By the time the school contacts a family, the habit is established and trust is damaged.
• Teachers have no external accountability for punctuality or unexplained absences, creating a culture where both staff and student tardiness become normalised.
• School administrators make critical staffing and resource decisions based on inaccurate, delayed, or manipulated data.
• Attendance reports arrive weekly or monthly — far too late to intervene when a student begins to disengage.
• Fee collection suffers systematically because absent and unregistered students are not flagged for follow-up until it is too late.
• Discipline becomes reactive rather than preventive: by the time a pattern is visible, significant damage has already occurred.
• Education authorities are tightening requirements for verifiable, time-stamped attendance records. Manual registers do not meet this standard.$prob$,

  $soln$DRAIS transforms your school from reactive to intelligent. Starting with fingerprint-based attendance — the most reliable, fraud-proof identity method available at scale — DRAIS builds a complete real-time picture of every student's presence.

DRAIS works in the background, automatically:

• Every student entry and exit is recorded the instant it happens — no manual input, no delays, no falsification possible
• Parents receive an automated SMS within 60 seconds of their child's absence being detected — no waiting, no guessing
• School administrators see a live dashboard showing real-time headcount, attendance alerts, and emerging patterns from any device
• The system generates daily, weekly, and termly attendance reports automatically — formatted and ready for inspection at any time
• Academic performance, fee collection, communication, and records management are fully integrated in one platform
• All data is stored securely in the cloud and accessible from anywhere at any time

DRAIS does not just record attendance. It makes attendance the intelligent engine of your school's entire operations — the unbreakable foundation that everything else is built on.$soln$,

  $attn$Attendance is not just a register. It is the single most reliable indicator of everything that matters in a school.

Academic performance: Students who are present learn. Students who are absent fall behind. Every study across the African education sector confirms that attendance is the strongest predictor of academic outcomes. DRAIS ensures you never lose a student to undocumented absence.

Financial health: Present students pay fees. Absent and unregistered students represent lost revenue that compounds over every term. DRAIS connects real-time attendance directly to fee management, closing the gap between presence and payment automatically.

Parent trust: Parents who receive real-time notifications about their child's presence are engaged, loyal parents. Parents who discover their child was absent for days without notification are former customers — and vocal critics. DRAIS turns every absence into an immediate parent touchpoint that builds rather than erodes the relationship.

Staff accountability: Teacher presence drives student presence. When staff know their own attendance is visible and recorded, a culture of shared accountability emerges naturally. Excellence becomes visible at every level of the institution.

School safety: Knowing exactly who is on your school grounds at any given moment is a fundamental duty of care. DRAIS gives you that certainty — instantly and automatically, without manual effort.

Attendance is the foundation of education. Without presence, nothing else matters. DRAIS makes that foundation unbreakable.$attn$,

  $coi$Every day without DRAIS carries a measurable, compounding cost that most school leaders consistently underestimate.

Revenue leakage from poor tracking: Schools operating with manual attendance systems typically lose between 15 and 30 percent of potential fee income each term. When absent, unregistered, or part-time students are not flagged early enough for financial follow-up, fees go uncollected silently. For a school with 500 students at UGX 500,000 per term, this represents between UGX 37 million and UGX 75 million lost every single year — not from inability to collect, but from inability to see who needs to be collected from.

Operational inefficiency: Manual attendance collection for 500 students consumes between 90 and 120 minutes of productive teacher time every school day. Over a 180-day academic year, this equals approximately 300 hours of teaching capacity lost permanently to administration that DRAIS would eliminate entirely.

Parent trust and enrollment retention: Parents at institutions with real-time communication systems are significantly less likely to withdraw students mid-term. Each family that leaves due to poor communication represents years of lost fee income plus the reputational damage of word-of-mouth in tightly connected school communities.

Compliance and inspection risk: Education authorities across Uganda and East Africa are tightening requirements for attendance record-keeping. Schools found with unverifiable, inaccurate, or incomplete registers face formal warnings, operational restrictions, and lasting reputational damage in their communities.

Missed early intervention: Without attendance pattern data, learning difficulties, bullying, and dropout risk remain invisible until they become crises. DRAIS automatically flags at-risk students weeks before problems become visible — enabling early, compassionate intervention rather than reactive crisis management.

The cost of inaction does not hold steady. It compounds every week, every term, every year.$coi$,

  $trns$Schools that deploy DRAIS report consistent, measurable transformation from the very first term.

Complete visibility replaces daily uncertainty: Administrators know exactly who is on school grounds at every moment. The anxiety of not knowing who is present gives way to the confidence of real-time, reliable, tamper-proof data.

Parent relationships transform permanently: Automated SMS notifications change the dynamic between school and family. Parents report feeling genuinely connected to their children's school life — and that connection translates directly into trust, loyalty, and consistent fee payment on time.

A culture of accountability emerges: When attendance data is visible, transparent, and objective — for students and staff alike — behaviour changes naturally. Tardiness, absenteeism, and register manipulation all decline when the data cannot be falsified or ignored.

Administration becomes intelligent: Schools report eliminating between 8 and 15 hours of manual attendance-related administration per week, redirecting that capacity to teaching, student support, and institutional growth.

Financial performance improves measurably: Schools with previously inconsistent fee collection consistently report measurable improvement in recovery rates after DRAIS deployment. The direct connection between daily attendance and fee status makes collection self-reinforcing and systematic.

DRAIS is not an upgrade to your current system. It is the replacement of a process that was always broken — with an intelligence-driven foundation built for how modern schools must operate.$trns$

) ON CONFLICT (system_id) DO UPDATE SET
  problem_block          = EXCLUDED.problem_block,
  solution_block         = EXCLUDED.solution_block,
  why_attendance_first   = EXCLUDED.why_attendance_first,
  cost_of_inaction_block = EXCLUDED.cost_of_inaction_block,
  transformation_block   = EXCLUDED.transformation_block,
  updated_at             = NOW();

-- ----------------------------------------------------------------
-- 6. Seed DRAIS comparison matrix
--    Keys are plan UUIDs for maximum flexibility
-- ----------------------------------------------------------------
UPDATE drais_systems
SET comparison_matrix = '[
  {"label": "Max Students",              "category": "capacity",      "b1000000-0000-0000-0000-000000000001": "Up to 1,000",  "b1000000-0000-0000-0000-000000000002": "Up to 2,000",  "b1000000-0000-0000-0000-000000000003": "Unlimited"},
  {"label": "Fingerprint Attendance",    "category": "core",          "b1000000-0000-0000-0000-000000000001": "\u2714",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Real-time Parent SMS",      "category": "core",          "b1000000-0000-0000-0000-000000000001": "\u2714",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Student Information",       "category": "records",       "b1000000-0000-0000-0000-000000000001": "\u2714",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "SMS Broadcast Messaging",   "category": "communication", "b1000000-0000-0000-0000-000000000001": "\u2714",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Attendance Reports",        "category": "analytics",     "b1000000-0000-0000-0000-000000000001": "Daily",        "b1000000-0000-0000-0000-000000000002": "Advanced",     "b1000000-0000-0000-0000-000000000003": "Custom"},
  {"label": "Analytics Dashboard",       "category": "analytics",     "b1000000-0000-0000-0000-000000000001": "Basic",        "b1000000-0000-0000-0000-000000000002": "Advanced",     "b1000000-0000-0000-0000-000000000003": "Custom"},
  {"label": "Exam & Report Cards",       "category": "academics",     "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Mobile App",                "category": "access",        "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Parent Portal",             "category": "communication", "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2714",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Multi-Campus Support",      "category": "scale",         "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2716",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Custom Integrations",       "category": "scale",         "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2716",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Dedicated Account Manager", "category": "support",       "b1000000-0000-0000-0000-000000000001": "\u2716",        "b1000000-0000-0000-0000-000000000002": "\u2716",        "b1000000-0000-0000-0000-000000000003": "\u2714"},
  {"label": "Support Level",             "category": "support",       "b1000000-0000-0000-0000-000000000001": "Email & Phone", "b1000000-0000-0000-0000-000000000002": "Priority",     "b1000000-0000-0000-0000-000000000003": "24/7 Dedicated"}
]'::JSONB
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
