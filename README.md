# SentinelX

## IPHYN's Intelligent Cybersecurity Incident Detection and Response System

SentinelX is the proposed cybersecurity incident detection and response system for IPHYN, a technology consulting organization.

This repository is the implementation control center and technical source of truth.

### Non-negotiable boundaries

- System: SentinelX
- Case-study organization: IPHYN
- Database: PostgreSQL
- Supabase: not used
- Required foundation: deterministic/rule-based detection
- Advanced layer: machine-learning anomaly detection
- Core workflow: Event → Detection → Alert → Incident → Investigation → Response → Resolution → Reporting
- External SIEM integration is optional and never replaces the standalone SentinelX core.
- SentinelX is not an antivirus, vulnerability scanner, penetration-testing framework, firewall, malware sandbox, or full enterprise SIEM/SOAR replacement.
- Automated response is controlled and auditable. No destructive actions are part of the core project.

### Task system

Implement `tasks/01` through `tasks/43` in numerical order.

Every task defines objective, dependencies, scope, exclusions, implementation rules, acceptance criteria, deliverables, and a completion gate.

**An AI receiving a task must implement only that task. It must not invent requirements, redesign SentinelX, or expand scope.**

### Final demonstration

A security event must be able to move through:

Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting

Important actions must also appear in the audit trail.
