BEGIN TRANSACTION;

-- Standards Table (matches education-store.ts)
CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  category TEXT,
  domain TEXT,
  description TEXT,
  prerequisites TEXT, -- JSON
  cluster TEXT
);

-- Standard Mastery Table (matches education-store.ts)
CREATE TABLE IF NOT EXISTS standard_mastery (
  student_id TEXT,
  standard_id TEXT,
  mastery_level REAL DEFAULT 0,
  evidence_count INTEGER DEFAULT 0,
  last_practiced_at INTEGER,
  status TEXT,
  confidence_score REAL DEFAULT 0,
  PRIMARY KEY (student_id, standard_id),
  FOREIGN KEY(standard_id) REFERENCES standards(id)
);

-- Concepts Table (Phase 6)
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT,
  definition TEXT,
  discipline TEXT,
  layer TEXT
);

-- Standard Concepts Mapping (Phase 6)
CREATE TABLE IF NOT EXISTS standard_concepts (
  standard_id TEXT,
  concept_id TEXT,
  authenticity_layer TEXT,
  notes TEXT,
  PRIMARY KEY (standard_id, concept_id),
  FOREIGN KEY(standard_id) REFERENCES standards(id),
  FOREIGN KEY(concept_id) REFERENCES concepts(id)
);

-- Assignments Table (needed for getAssignmentStats)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  subject TEXT,
  platform TEXT,
  status TEXT,
  due_date INTEGER,
  title TEXT
);

COMMIT;
