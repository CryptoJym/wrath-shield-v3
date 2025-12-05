
import { getDomains, getMappings, getLifeCharter } from '../lib/life-os-config';
import githubClient from '../lib/integrations/GitHubClient';

async function main() {
    console.log("=== Debugging Repo Mapping Logic ===");

    // 1. Check Configs
    const domains = getDomains();
    const mappings = getMappings();
    console.log(`Loaded ${domains.domains.length} domains and ${mappings.project_mappings.length} project mappings.`);

    // 2. Fetch Repos
    console.log("\nFetching Repos from GitHub...");
    try {
        if (!githubClient.isConfigured()) {
            console.error("GitHub Client is NOT configured (missing env vars).");
            return;
        }
        const repos = await githubClient.getRepos({ limit: 100 });
        console.log(`Fetched ${repos.length} repos.`);

        console.log("\nSample Repos:");
        repos.slice(0, 5).forEach(r => console.log(`- ${r.full_name} (id: ${r.id})`));

        // 3. Run Mapping Logic
        console.log("\n--- MAPPING ANALYSIS ---");

        const mappedRepoNames = new Set<string>();

        for (const domain of domains.domains) {
            console.log(`\nDomain: ${domain.name} (${domain.id})`);
            const domainMappings = mappings.project_mappings.filter(m => m.domains.includes(domain.id));

            if (domainMappings.length === 0) {
                console.log("  (No mappings found)");
                continue;
            }

            for (const mapping of domainMappings) {
                console.log(`  Project: ${mapping.motion_projects[0] || mapping.id}`);
                console.log(`    Expected Repos in Config:`, mapping.github_repos);

                // Check matches
                const matches = repos.filter(repo =>
                    mapping.github_repos.includes(repo.full_name) ||
                    mapping.github_repos.includes(repo.name)
                );

                if (matches.length > 0) {
                    matches.forEach(m => {
                        console.log(`    [MATCH] ${m.name}`);
                        mappedRepoNames.add(m.name);
                    });
                } else {
                    console.log(`    [NO MATCHES FOUND]`);
                }
            }
        }

        // 4. Unmapped
        console.log("\n--- UNMAPPED ANALYSIS ---");
        const unmapped = repos.filter(r => !mappedRepoNames.has(r.name));
        console.log(`Found ${unmapped.length} unmapped repos.`);
        if (unmapped.length > 0) {
            console.log("Top 10 Unmapped:");
            unmapped.slice(0, 10).forEach(r => console.log(`- ${r.full_name}`));
        }

    } catch (e) {
        console.error("Error fetching/processing:", e);
    }
}

main();
