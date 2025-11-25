-- No-op migration to keep main app DB aligned; relationship DB handles contacts independently.

INSERT INTO migrations (name) VALUES ('008_contacts_canonical')
  ON CONFLICT(name) DO NOTHING;
