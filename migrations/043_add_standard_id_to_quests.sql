ALTER TABLE hyro_quests ADD COLUMN standard_id TEXT;
CREATE INDEX IF NOT EXISTS idx_quests_standard ON hyro_quests(standard_id);

INSERT INTO migrations (name) VALUES ('043_add_standard_id_to_quests');
