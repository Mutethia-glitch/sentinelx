# SentinelX Project Specification

## Project Identity
- Full title: IPHYN's Intelligent Cybersecurity Incident Detection and Response System
- System name: SentinelX
- Case-study organization: IPHYN
- Project type: Information Technology Final Year Project

## Purpose
SentinelX is intended to provide a centralized platform for identifying, analyzing, managing, investigating, and responding to cybersecurity incidents within the IPHYN case-study environment.

## Core Workflow
Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting

## Core Capabilities
- Security-event ingestion and normalization
- Rule-based threat detection
- Configurable detection rules
- Alert generation and management
- Alert correlation
- Incident lifecycle management
- Investigation workspace
- Risk and severity assessment
- Controlled response workflow
- Notifications
- Security dashboard
- Search and filtering
- Security reporting
- Audit trail
- MITRE ATT&CK mapping
- Role-based access control
- Machine-learning anomaly detection as an advanced supporting layer
- Optional external SIEM/log integration boundary

## Boundaries
SentinelX is not an antivirus, penetration-testing framework, vulnerability scanner, firewall, malware sandbox, offensive-security platform, or complete replacement for enterprise SIEM/SOAR products.

## Technology Constraint
PostgreSQL is the database direction. Supabase is explicitly excluded.

## Detection Principle
Deterministic and explainable rule-based detection is the foundation. Machine learning is a supporting layer and must not replace core detection.

## Development Principle
Implementation follows the numbered tasks in `tasks/`. A task must not silently expand the scope of a later task.
