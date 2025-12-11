
import { getAgentHealth } from './lib/agents/health';

async function verifyHealth() {
    console.log('Verifying Squad Health Integration...');
    try {
        const health = await getAgentHealth('agent.pm');
        console.log('Health Data Retrieved Successfully:');
        console.log(JSON.stringify(health, null, 2));

        if (health.agentId === 'agent.pm' && health.status) {
            console.log('VERIFICATION PASSED: Health data structure is valid.');
            process.exit(0);
        } else {
            console.error('VERIFICATION FAILED: Invalid health data structure.');
            process.exit(1);
        }
    } catch (error) {
        console.error('VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

verifyHealth();
