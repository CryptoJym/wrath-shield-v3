const MOTION_BASE = process.env.MOTION_API_BASE || 'https://api.usemotion.com/v1';

export type MotionTaskInput = {
  title: string;
  description?: string;
  due_iso?: string | null;
  duration_minutes?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'ASAP';
  project?: string | null;
  workspaceId?: string | null;
  status?: string | null;
};

export function hasMotionConfig(): boolean {
  return Boolean(process.env.MOTION_API_KEY);
}

export function getMotionClient() {
  const apiKey = process.env.MOTION_API_KEY;
  if (!apiKey) throw new Error('MOTION_API_KEY not set');
  return new MotionClient(apiKey);
}

class MotionClient {
  constructor(private apiKey: string) {}

  async createTask(input: MotionTaskInput): Promise<{ id: string }> {
    const body: any = {
      name: input.title,
      description: input.description ?? '',
    };
    if (input.workspaceId || process.env.MOTION_WORKSPACE_ID) {
      body.workspaceId = input.workspaceId ?? process.env.MOTION_WORKSPACE_ID;
    }
    if (input.due_iso) body.dueDate = input.due_iso;
    if (input.duration_minutes) body.estimatedDurationMinutes = input.duration_minutes;
    if (input.priority) body.priority = input.priority;
    if (input.project) body.projectId = input.project;
    if (input.status) body.status = input.status;

    const resp = await fetch(`${MOTION_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Motion API error ${resp.status}: ${txt}`);
    }
    const data = (await resp.json()) as any;
    return { id: data?.id || data?.taskId || 'unknown' };
  }
}
