# Fatherhood Science instrument-development protocol v0.1

**Status:** Draft — not approved for recruitment or data collection  
**Study code:** FS-INSTRUMENT-DEVELOPMENT  
**Protocol version:** 0.1  
**Accountable investigator:** Pending assignment  
**Organization:** Village Strong Foundation  
**Source workbook:** Fatherhood Science FRI/PPARS/EFAS Workbook v0.3  
**Prepared:** October 11, 2026  
**Ethics/IRB determination:** Pending

> This protocol organizes planning evidence only. It does not authorize expert
> outreach, interviews, enrollment, consent, pilot administration, or response
> collection. Each participant-facing phase requires the applicable written
> ethics determination and approved materials before it begins.

## 1. Purpose

Develop father-centered research instruments that describe strengths,
stressors, protective factors, adjustment, support, connection, and functioning
across the fatherhood life course and the perinatal transition.

The instruments are developmental. They are not diagnostic or clinical tools,
do not assess suicide risk, do not determine parental fitness, and must not be
used for custody, eligibility, punishment, or denial of services.

## 2. Instruments and current scope

| Code | Working name | Proposed population | Current stage | Draft items | Intended research use | Prohibited interpretation |
|---|---|---|---|---:|---|---|
| FRI | Fatherhood Resilience Index | Adult fathers across the parenting life course | Item development | 48 | Research, program evaluation, strengths-and-needs discussion | Diagnosis, custody, or parental-fitness decision |
| PPARS | Paternal Perinatal Adjustment and Resilience Scale | Adult expecting fathers and fathers through 12 months postpartum | Item development | 46 | Research, program evaluation, longitudinal perinatal assessment | Depression, medical, or suicide-risk screening |
| EFAS | Expectant Father Adjustment Scale | Adult expecting fathers from pregnancy recognition through birth | Item development | 41 | Research and evaluation of prenatal fatherhood support | Medical diagnosis or causal attribution of physical symptoms |

Anyone under 18 is excluded from protocol v0.1. Inclusion of minors would
require a new protocol version and written review covering parental permission,
assent, age verification, privacy, mandatory reporting, and additional
safeguards.

## 3. Working constructs

### FRI

Fatherhood resilience is the dynamic capacity to draw upon personal,
relational, social, and practical resources to maintain or restore healthy
paternal functioning during adversity. Proposed domains are paternal identity
and purpose; emotional regulation; parenting confidence; relational and
co-parenting capacity; social support and help-seeking; economic and role
adaptability; connection and accessibility; and recovery and future
orientation.

### PPARS

Paternal perinatal adjustment is the emotional, relational, behavioral,
physical, and practical adaptation from pregnancy through the first postpartum
year. Proposed domains are expectancy and transition readiness; paternal
identity transition; emotional adjustment; bonding and connection;
co-parenting partnership; practical role adaptation; sleep, stress, and
self-care; support and help-seeking; and hope, confidence, and recovery.

### EFAS

Expectant-father adjustment is the emotional, cognitive, relational,
practical, and stress-related physical adaptation after learning a child is
expected and before birth. Proposed domains are emotional response and
anticipation; readiness and role clarity; prenatal bonding and inclusion;
partner relationship and co-preparation; practical and financial adaptation;
physical stress experiences; support and help-seeking; and confidence, hope,
and adaptability.

Physical-experience items describe self-reported experiences only. They cannot
establish causation and must direct concerning symptoms toward appropriate
medical evaluation rather than an instrument score.

## 4. Research questions

1. What capacities enable fathers to maintain or restore healthy paternal
   functioning during adversity?
2. Does the proposed multidimensional FRI structure emerge in exploratory
   factor analysis and replicate in an independent sample?
3. What factors support paternal adjustment from pregnancy through the first
   postpartum year?
4. Do perinatal adjustment profiles differ across pregnancy, 0–3 months, 4–6
   months, and 7–12 months postpartum?
5. How does expecting a child affect adult fathers emotionally, physically,
   relationally, and practically before birth?
6. Which self-reported stress-related physical experiences are most common,
   and how are they associated with sleep, distress, and support?
7. Do scores function comparably across prespecified demographic and family
   groups when sample sizes support responsible testing?
8. In a later, separately approved longitudinal phase, how do EFAS scores relate
   to PPARS adjustment after birth and do scores respond to change over time?

These questions and their hypotheses remain provisional until literature,
lived-experience, and expert review is complete.

## 5. Staged design and decision gates

| Phase | Planned activity | Workbook planning range | Required output | Gate before next phase |
|---|---|---:|---|---|
| 1 | Construct development through literature review and lived-experience input | 15–30 adult fathers, proposed | Construct definitions, domain map, gap analysis | Constructs are distinct, relevant, and sufficiently comprehensive |
| 2 | Broad item development, reading-level and inclusivity review | 2–3 times anticipated final items | Item banks and rationale log | Every domain has adequate, nonredundant coverage |
| 3 | Expert content review, including lived experience | 6–10 reviewers, proposed | Relevance, clarity, cultural-fit, and alignment ratings | Weak, harmful, unclear, or redundant items are revised or removed |
| 4 | Cognitive interviews | 15–30 diverse adult fathers, proposed | Response-process matrix and revision log | Items are understood as intended and emotional impact is acceptable |
| 5 | Pilot administration and feasibility review | Approximately 300–500 adults per instrument, proposed | De-identified pilot dataset, missingness, distributions, feasibility evidence | Variability and item performance support exploratory analysis |
| 6 | Exploratory psychometric analysis | Pilot sample | Preliminary factor structure and reduced scales | Stable, interpretable factors emerge without overfitting |
| 7 | Independent confirmatory validation | Ideally 500+ adults, proposed | Confirmed structure, reliability, validity, and invariance evidence | Intended score interpretations are defensible for specified populations |
| 8 | Responsiveness and reference distributions | Separate longitudinal/diverse samples | Change metrics and reference distributions | Meaningful-change and comparison rules have adequate evidence |
| 9 | Manual and dissemination | Not participant-facing | Technical manual, qualifications, ethical limits, revision history | Use remains transparent, governed, and evidence-bounded |

The numbers above are workbook planning targets, not approved recruitment
quotas. Each participant-facing phase requires a phase-specific protocol or
approved amendment, power/sample-size justification, recruitment materials,
consent version, and data plan.

## 6. Phase-specific participant safeguards

- Participation must be voluntary and limited to adults under v0.1.
- Public Village Strong and FAMILY resources must remain available regardless
  of participation, refusal, or withdrawal.
- Recruitment must not imply clinical care, educational credit, certification,
  preferential services, or a validated assessment.
- Participants may skip an item, pause, or withdraw under the approved consent
  procedure.
- Distress, concerning physical symptoms, safety concerns, complaints, and
  privacy incidents require written escalation procedures before contact begins.
- No instrument result may be returned as a diagnosis, medical conclusion,
  suicide-risk determination, custody opinion, or parental-fitness finding.

## 7. Data minimization and separation

The approved implementation, if any, will use randomly generated participant
codes. The private `research` schema will not contain names, contact details,
birth dates, addresses, signatures, identity documents, or medical records.

Consent facts and scope are separate from item responses. Any approved contact
or identity-linkage record must live in a separate system with a documented
purpose, owner, access boundary, retention period, and deletion procedure. The
linkage secret must not appear in analysis exports.

No live data system may be connected until the role matrix, RLS policies,
denial tests, audit design, retention schedule, incident response, and staging
security review are approved.

## 8. Analysis plan

Analyses will match the development phase and measurement level. Planned
methods include:

- missingness, response distributions, floor/ceiling effects, and feasibility;
- corrected item-total correlations and redundancy review;
- McDonald’s omega and Cronbach’s alpha with uncertainty intervals, without
  relying on alpha alone;
- polychoric exploratory factor analysis, parallel analysis, and oblique
  rotation when appropriate for ordinal items;
- ordinal confirmatory factor analysis in an independent sample;
- test–retest reliability using a construct-appropriate interval;
- convergent, discriminant, and prespecified known-groups validity;
- measurement invariance or differential item functioning only for adequately
  represented groups;
- responsiveness using prespecified anchor- and distribution-based methods.

The analysis plan must define missing-data handling, exclusions, estimator,
fit criteria, multiplicity, model revisions, sensitivity analyses, software and
versions, and reporting of null or unfavorable results before confirmatory
analysis begins. Exploratory and confirmatory samples must remain independent.

## 9. Equity and interpretive limits

Development should seek relevant perspectives across marital and relationship
status, custodial circumstances, step/adoptive/foster roles, military status,
access to children, age, race/ethnicity, culture, and socioeconomic conditions.
Representation does not by itself establish invariance. Group comparisons and
norms must not be published when samples or evidence are inadequate.

## 10. Governance and change control

All item, domain, scoring, protocol, consent, recruitment, population, vendor,
purpose, and security changes require versioning and review. Immediate action
may be taken to remove an apparent hazard, followed by required notification
and documentation.

The authoritative governance record must link the protocol, instrument,
consent, ethics determination, retention plan, access assignments, analysis
plan, and code/data release for the same approved version.

## 11. Current go/no-go record

| Gate | Status |
|---|---|
| Accountable investigator assigned | Pending |
| Literature review complete | Pending |
| Ethics/IRB determination | Pending |
| Phase-specific protocol | Pending |
| Consent and withdrawal materials | Pending |
| Retention/deletion/incident plan | Pending |
| Named access assignments | Pending |
| RLS policies and staging tests | Pending |
| Recruitment authorization | **No-go** |
| Data-collection authorization | **No-go** |

## 12. Revision history

| Version | Date | Change | Decision maker | Status |
|---|---|---|---|---|
| 0.1 | 2026-10-11 | Converted workbook v0.3 concepts and roadmap into a controlled umbrella protocol draft | Pending | Draft |
