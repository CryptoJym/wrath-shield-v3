const fs = require('fs');
const path = require('path');

const STANDARDS_DIR = path.join(process.cwd(), 'data', 'standards');
const CONCEPTS_DIR = path.join(process.cwd(), 'data', 'concepts');
const OUT_FILE = path.join(process.cwd(), 'scripts', 'ingest-authentic-data.sql');

let sql = `BEGIN TRANSACTION;\n\n`;

// Helper to escape SQL strings
const esc = (str) => {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str === 'object') return `'${JSON.stringify(str).replace(/'/g, "''")}'`;
    return `'${String(str).replace(/'/g, "''")}'`;
};

// 1. Process Concepts
if (fs.existsSync(CONCEPTS_DIR)) {
    const files = fs.readdirSync(CONCEPTS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(CONCEPTS_DIR, file), 'utf-8'));

        // Insert Concept
        sql += `INSERT OR REPLACE INTO concepts (id, name, definition, discipline, layer) VALUES (${esc(data.id)}, ${esc(data.name)}, ${esc(data.definition)}, ${esc(data.discipline)}, ${esc(data.layer)});\n`;

        // Process Mappings
        if (data.mappings) {
            for (const map of data.mappings) {
                sql += `INSERT OR REPLACE INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes) VALUES (${esc(map.standard_id)}, ${esc(data.id)}, ${esc(map.authenticity_layer)}, ${esc(map.notes)});\n`;
            }
        }
        sql += '\n';
    }
}

// 2. Process Standards
if (fs.existsSync(STANDARDS_DIR)) {
    const files = fs.readdirSync(STANDARDS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(STANDARDS_DIR, file), 'utf-8'));

        // Handle Nested Format (Science/Math)
        if (data.domains) {
            for (const domain of data.domains) {
                for (const std of domain.standards) {
                    sql += `INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            ${esc(std.id)}, 
            ${esc(data.subject)}, 
            ${esc(domain.name)}, 
            ${esc(std.description)}, 
            ${esc(std.prerequisites || [])}, 
            ${esc(std.cluster)}
          );\n`;
                }
            }
        }
        // Handle Flat Format (ELA)
        else if (Array.isArray(data)) {
            for (const std of data) {
                sql += `INSERT OR REPLACE INTO standards (id, category, domain, description, prerequisites, cluster) VALUES (
            ${esc(std.id)}, 
            ${esc(std.category)}, 
            ${esc(std.domain)}, 
            ${esc(std.description)}, 
            ${esc(std.prerequisites || [])}, 
            ${esc(std.cluster)}
          );\n`;
            }
        }
    }
}

sql += `COMMIT;\n`;

fs.writeFileSync(OUT_FILE, sql);
console.log(`Generated SQL to ${OUT_FILE}`);
