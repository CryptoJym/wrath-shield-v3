/**
 * Proactive Admin Endpoint
 *
 * CRUD operations for tasks, triggers, and monitors.
 *
 * Usage:
 *   GET  /api/proactive/admin?type=tasks|triggers|monitors
 *   POST /api/proactive/admin - Create new item
 *   PUT  /api/proactive/admin - Update item
 *   DELETE /api/proactive/admin?type=tasks&id=xxx - Delete item
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProactiveEnablement,
  type ScheduledTask,
  type EventTrigger,
  type ThresholdMonitor,
  type ProactiveAction,
  type TaskFrequency,
  type TriggerType,
  type TriggerCondition,
} from '@/lib/agents/ProactiveEnablement';
import type { LifeOSAgentId } from '@/lib/agents/UnifiedBus';

// =============================================================================
// GET - List items
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    const proactive = getProactiveEnablement();
    await proactive.initialize();

    // Get specific item by ID
    if (id) {
      let item;
      switch (type) {
        case 'tasks':
          item = proactive.getScheduledTasks().find(t => t.id === id);
          break;
        case 'triggers':
          item = proactive.getEventTriggers().find(t => t.id === id);
          break;
        case 'monitors':
          item = proactive.getThresholdMonitors().find(m => m.id === id);
          break;
        default:
          return NextResponse.json({ error: 'Invalid type. Use: tasks, triggers, monitors' }, { status: 400 });
      }

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      return NextResponse.json({ item });
    }

    // List all items of type
    switch (type) {
      case 'tasks':
        return NextResponse.json({ tasks: proactive.getScheduledTasks() });
      case 'triggers':
        return NextResponse.json({ triggers: proactive.getEventTriggers() });
      case 'monitors':
        return NextResponse.json({ monitors: proactive.getThresholdMonitors() });
      default:
        // Return all if no type specified
        return NextResponse.json({
          tasks: proactive.getScheduledTasks(),
          triggers: proactive.getEventTriggers(),
          monitors: proactive.getThresholdMonitors(),
        });
    }

  } catch (error) {
    console.error('[ProactiveAdmin] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get items', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new item
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required (tasks, triggers, monitors)' }, { status: 400 });
    }

    const proactive = getProactiveEnablement();
    await proactive.initialize();

    let created: any;

    switch (type) {
      case 'tasks':
        // Validate required fields
        if (!data.name || !data.agentId || !data.frequency || !data.action) {
          return NextResponse.json(
            { error: 'Missing required fields: name, agentId, frequency, action' },
            { status: 400 }
          );
        }
        created = proactive.addScheduledTask({
          name: data.name,
          description: data.description || '',
          agentId: data.agentId as LifeOSAgentId,
          frequency: data.frequency as TaskFrequency,
          action: data.action as ProactiveAction,
          enabled: data.enabled !== false,
        });
        break;

      case 'triggers':
        if (!data.name || !data.type || !data.agentId || !data.conditions || !data.action) {
          return NextResponse.json(
            { error: 'Missing required fields: name, type, agentId, conditions, action' },
            { status: 400 }
          );
        }
        created = proactive.addEventTrigger({
          name: data.name,
          type: data.type as TriggerType,
          agentId: data.agentId as LifeOSAgentId,
          conditions: data.conditions as TriggerCondition[],
          action: data.action as ProactiveAction,
          enabled: data.enabled !== false,
        });
        break;

      case 'monitors':
        if (!data.name || !data.agentId || !data.metric || data.threshold === undefined || !data.comparison || !data.action) {
          return NextResponse.json(
            { error: 'Missing required fields: name, agentId, metric, threshold, comparison, action' },
            { status: 400 }
          );
        }
        created = proactive.addThresholdMonitor({
          name: data.name,
          agentId: data.agentId as LifeOSAgentId,
          metric: data.metric,
          threshold: data.threshold,
          comparison: data.comparison as 'above' | 'below' | 'equals',
          action: data.action as ProactiveAction,
          cooldownMs: data.cooldownMs || 3600000, // Default 1 hour
          enabled: data.enabled !== false,
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid type. Use: tasks, triggers, monitors' }, { status: 400 });
    }

    return NextResponse.json({ success: true, created }, { status: 201 });

  } catch (error) {
    console.error('[ProactiveAdmin] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create item', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update item (toggle enabled, execute task)
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, action: updateAction, enabled } = body;

    if (!type || !id) {
      return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
    }

    const proactive = getProactiveEnablement();
    await proactive.initialize();

    // Handle special actions
    if (updateAction === 'execute' && type === 'tasks') {
      const result = await proactive.executeTask(id);
      return NextResponse.json({ success: result.success, result });
    }

    // Handle enable/disable toggle
    if (enabled !== undefined) {
      let success = false;
      switch (type) {
        case 'tasks':
          success = proactive.toggleTask(id, enabled);
          break;
        case 'triggers':
          success = proactive.toggleTrigger(id, enabled);
          break;
        case 'monitors':
          success = proactive.toggleMonitor(id, enabled);
          break;
        default:
          return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }

      if (!success) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, id, enabled });
    }

    return NextResponse.json({ error: 'No valid update action specified' }, { status: 400 });

  } catch (error) {
    console.error('[ProactiveAdmin] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update item', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete item
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json({ error: 'type and id query params are required' }, { status: 400 });
    }

    const proactive = getProactiveEnablement();
    await proactive.initialize();

    let success = false;
    switch (type) {
      case 'tasks':
        success = proactive.deleteTask(id);
        break;
      case 'triggers':
        success = proactive.deleteTrigger(id);
        break;
      case 'monitors':
        success = proactive.deleteMonitor(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type. Use: tasks, triggers, monitors' }, { status: 400 });
    }

    if (!success) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: id });

  } catch (error) {
    console.error('[ProactiveAdmin] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete item', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
