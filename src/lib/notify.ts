import { prisma } from './prisma'

export async function createNotification(type: string, message: string, userId?: number | null) {
  try {
    await prisma.notification.create({
      data: { type, message, userId: userId ?? null },
    })
  } catch (err) {
    console.error('Notification creation failed:', err)
  }
}

export async function getUnreadCount() {
  try {
    return await prisma.notification.count({ where: { read: false } })
  } catch {
    return 0
  }
}
