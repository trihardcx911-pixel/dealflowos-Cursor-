/**
 * Task Store - Dual-mode CRUD (DB + in-memory fallback)
 * 
 * Provides task persistence with automatic fallback to in-memory storage
 * when DATABASE_URL is not available (dev mode).
 */

import { prisma } from "../db/prisma.js";
import crypto from "crypto";

export interface Task {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  description: string | null;
  status: string; // 'pending' | 'completed' | 'cancelled'
  urgency: string; // 'low' | 'medium' | 'critical'
  dueAt: Date | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskInput {
  orgId: string;
  userId: string;
  title: string;
  description?: string | null;
  status?: string;
  urgency?: string; // 'low' | 'medium' | 'critical'
  dueAt?: Date | null;
  leadId?: string | null;
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

// In-memory storage: `${orgId}:${userId}` -> Task[]
const tasksByOrgUser: Record<string, Task[]> = {};

/**
 * Get storage key for org+user combination
 */
function getStorageKey(orgId: string, userId: string): string {
  return `${orgId}:${userId}`;
}

/**
 * List tasks for org+user
 */
export async function listTasks(
  orgId: string,
  userId: string,
  limit: number = 100
): Promise<Task[]> {
  if (hasDatabase) {
    return await prisma.task.findMany({
      where: { orgId, userId },
      orderBy: [
        { dueAt: 'asc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  } else {
    // Dev mode: in-memory
    const key = getStorageKey(orgId, userId);
    const tasks = tasksByOrgUser[key] || [];
    
    // Sort: dueAt asc (nulls last), then createdAt desc
    const sorted = [...tasks].sort((a, b) => {
      if (a.dueAt && b.dueAt) {
        return a.dueAt.getTime() - b.dueAt.getTime();
      }
      if (a.dueAt && !b.dueAt) return -1;
      if (!a.dueAt && b.dueAt) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    return sorted.slice(0, limit);
  }
}

/**
 * Get single task by ID (with ownership check)
 */
export async function getTaskById(
  taskId: string,
  orgId: string,
  userId: string
): Promise<Task | null> {
  if (hasDatabase) {
    return await prisma.task.findFirst({
      where: { id: taskId, orgId, userId }
    });
  } else {
    // Dev mode
    const key = getStorageKey(orgId, userId);
    const tasks = tasksByOrgUser[key] || [];
    return tasks.find(t => t.id === taskId) || null;
  }
}

/**
 * Create task
 */
export async function createTask(data: TaskInput): Promise<Task> {
  // Explicitly set all required fields (belt + suspenders approach)
  const now = new Date();
  const taskData = {
    id: crypto.randomUUID(), // Explicitly generate ID (Prisma would generate, but ensure it)
    ...data,
    description: data.description || null,
    status: data.status || 'pending',
    urgency: data.urgency || 'medium',
    dueAt: data.dueAt || null,
    leadId: data.leadId || null,
    createdAt: now, // Explicitly set (DB has default, but ensure it)
    updatedAt: now,  // Explicitly set (DB has default, but ensure it)
  };

  if (hasDatabase) {
    return await prisma.task.create({
      data: taskData
    });
  } else {
    // Dev mode
    const task: Task = {
      ...taskData,
    };

    const key = getStorageKey(data.orgId, data.userId);
    if (!tasksByOrgUser[key]) {
      tasksByOrgUser[key] = [];
    }
    tasksByOrgUser[key].push(task);

    return task;
  }
}

/**
 * Update task (with ownership check)
 */
export async function updateTask(
  taskId: string,
  orgId: string,
  userId: string,
  updates: Partial<Omit<Task, 'id' | 'orgId' | 'userId' | 'createdAt'>>
): Promise<Task | null> {
  if (hasDatabase) {
    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id: taskId, orgId, userId }
    });

    if (!existing) {
      return null;
    }

    return await prisma.task.update({
      where: { id: taskId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
  } else {
    // Dev mode
    const key = getStorageKey(orgId, userId);
    const tasks = tasksByOrgUser[key] || [];
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return null; // Not found or ownership mismatch
    }

    const task = tasks[taskIndex];
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };

    tasks[taskIndex] = updatedTask;
    return updatedTask;
  }
}

/**
 * Delete task (with ownership check)
 */
export async function deleteTask(
  taskId: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  if (hasDatabase) {
    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id: taskId, orgId, userId }
    });

    if (!existing) {
      return false;
    }

    await prisma.task.delete({
      where: { id: taskId }
    });

    return true;
  } else {
    // Dev mode
    const key = getStorageKey(orgId, userId);
    const tasks = tasksByOrgUser[key] || [];
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return false; // Not found or ownership mismatch
    }

    tasks.splice(taskIndex, 1);
    return true;
  }
}



