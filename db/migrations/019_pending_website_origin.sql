-- Tenant-scoped requested site; not considered connected or domain-verified.
ALTER TABLE tenant_profile ADD COLUMN requested_website_origin text
 CHECK (requested_website_origin IS NULL OR
    (length(requested_website_origin)<=300 AND requested_website_origin ~ '^https://[a-z0-9.-]+$'));
