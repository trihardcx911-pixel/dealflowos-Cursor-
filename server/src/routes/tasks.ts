/**
 * Tasks API Routes
 * 
 * CRUD endpoints for tasks with reminder integration.
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as taskStore from "../tasks/taskStore.js";
import {
  createOrUpdateReminderForTask,
  cancelRemindersForTask
} from "../reminders/reminderService.js";

const router = Router();

// Constants
const MAX_TASK_TITLE_LEN = 80;

// Validation schemas
const createTaskSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TASK_TITLE_LEN, `Title must be ${MAX_TASK_TITLE_LEN} characters or less`),
  description: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(), // ISO string
  urgency: z.enum(['low', 'medium', 'critical']).optional().default('medium'),
  enableReminder: z.boolean().optional().default(true),
  reminderOffset: z.number().optional().default(-60),
  leadId: z.string().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TASK_TITLE_LEN, `Title must be ${MAX_TASK_TITLE_LEN} characters or less`)
    .optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  urgency: z.enum(['low', 'medium', 'critical']).optional(),
  dueAt: z.string().optional().nullable(), // ISO string
  enableReminder: z.boolean().optional(),
  reminderOffset: z.number().optional(),
  leadId: z.string().optional().nullable(),
});

/**
 * GET /api/tasks
 * List tasks for current user/org
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tasks = await taskStore.listTasks(orgId, userId);
    return res.json({ tasks });
  } catch (error: any) {
    console.error("[TASKS API] Error listing tasks:", error);
    return res.status(500).json({ error: "Failed to list tasks" });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = createTaskSchema.parse(req.body);

    // Parse dueAt if provided
    let dueAt: Date | null = null;
    if (data.dueAt) {
      dueAt = new Date(data.dueAt);
      if (isNaN(dueAt.getTime())) {
        return res.status(400).json({ error: "Invalid dueAt date format" });
      }
    }

    // Create task
    const task = await taskStore.createTask({
      orgId,
      userId,
      title: data.title,
      description: data.description || null,
      status: 'pending',
      urgency: data.urgency || 'medium',
      dueAt,
      leadId: data.leadId || null,
    });

    // Create reminder only if dueAt is present (skip if null, even if enableReminder is true)
    if (dueAt && data.enableReminder !== false) {
      try {
        // Extract timezone from header (preferred) or default to UTC
        const timezone = req.headers['x-timezone'] as string || null;
        
        await createOrUpdateReminderForTask({
          orgId,
          userId,
          taskId: task.id,
          taskDueAt: dueAt,
          reminderOffset: data.reminderOffset,
          timezone
        });
        console.log("[TASKS API] ✓ Reminder created for task");
      } catch (reminderError: any) {
        console.error("[TASKS API] ⚠ Failed to create reminder:", reminderError.message);
        // Don't fail task creation if reminder fails
      }
    }

    return res.status(201).json(task);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    // Safe error logging (dev-safe)
    console.error("[TASKS] create failed", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({
      code: "TASK_CREATE_FAILED",
      error: "Failed to create task",
    });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || userId;
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = updateTaskSchema.parse(req.body);

    // Get existing task for comparison
    const existingTask = await taskStore.getTaskById(taskId, orgId, userId);

    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Parse dueAt if provided
    let dueAt: Date | null | undefined = undefined;
    if (data.dueAt !== undefined) {
      if (data.dueAt === null) {
        dueAt = null;
      } else {
        dueAt = new Date(data.dueAt);
        if (isNaN(dueAt.getTime())) {
          return res.status(400).json({ error: "Invalid dueAt date format" });
        }
      }
    }

    // Build update payload
    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.urgency !== undefined) updatePayload.urgency = data.urgency;
    if (dueAt !== undefined) updatePayload.dueAt = dueAt;
    if (data.leadId !== undefined) updatePayload.leadId = data.leadId;

    // Update task
    const updatedTask = await taskStore.updateTask(taskId, orgId, userId, updatePayload);

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Handle reminder logic
    const statusCompleted = data.status === 'completed' || data.status === 'cancelled';
    const dueAtRemoved = dueAt === null;

    if (statusCompleted || dueAtRemoved) {
      // Cancel reminders
      try {
        await cancelRemindersForTask({ orgId, userId, taskId });
        console.log("[TASKS API] ✓ Reminders cancelled for task");
      } catch (reminderError: any) {
        console.error("[TASKS API] ⚠ Failed to cancel reminders:", reminderError.message);
      }
    } else if (dueAt !== undefined || data.reminderOffset !== undefined) {
      // DueAt changed or offset changed - update reminder if enabled
      const enableReminder = data.enableReminder !== false; // Default true if not explicitly false
      
      if (enableReminder) {
        const finalDueAt = dueAt !== undefined ? dueAt : existingTask.dueAt;
        
        if (finalDueAt) {
          try {
            // Extract timezone from header (preferred) or default to UTC
            const timezone = req.headers['x-timezone'] as string || null;
            const offsetToUse = data.reminderOffset !== undefined ? data.reminderOffset : -60;
            
            await createOrUpdateReminderForTask({
              orgId,
              userId,
              taskId,
              taskDueAt: finalDueAt,
              reminderOffset: offsetToUse,
              timezone
            });
            console.log("[TASKS API] ✓ Reminder updated for task");
          } catch (reminderError: any) {
            console.error("[TASKS API] ⚠ Failed to update reminder:", reminderError.message);
          }
        }
      }
    }

    return res.json(updatedTask);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("[TASKS API] Error updating task:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || userId;
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Cancel reminders first
    try {
      await cancelRemindersForTask({ orgId, userId, taskId });
    } catch (reminderError: any) {
      console.error("[TASKS API] ⚠ Failed to cancel reminders:", reminderError.message);
      // Don't fail deletion if reminder cancellation fails
    }

    // Delete task
    const deleted = await taskStore.deleteTask(taskId, orgId, userId);

    if (!deleted) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[TASKS API] Error deleting task:", error);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;



