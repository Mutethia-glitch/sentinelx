-- The website at signup is non-authoritative metadata and is never scanned.
ALTER TABLE tenants ADD COLUMN requested_website_origin text
 CHECK (requested_website_origin IS NULL OR
    (length(requested_website_origin)<=300 AND requested_website_origin ~ '^https://[a-z0-9.-]+$'));
