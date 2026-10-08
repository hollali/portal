import { prisma } from './prisma'

/**
 * Whether /ask shows the animated guide.
 *
 * A setting rather than a code change, because the guide is a likeness of a
 * living person and the Speaker's office must be able to have it removed
 * promptly. A flag behind a deploy is not prompt: it is a deploy plus a
 * rollback, in the middle of a conversation with someone whose office asked.
 *
 * `Setting` is a key/value table already editable at /admin/settings, so this
 * costs a row rather than a migration and a redeploy. It is read on every
 * server render of /ask, which is dynamic anyway because of `?q=`, so a change
 * takes effect on the next page load.
 */
export const GUIDE_SETTING_KEY = 'ask.guide'

/** Anything other than an explicit `off` leaves the guide on. */
export function guideEnabledFromSetting(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() !== 'off'
}

/**
 * Defaults to on, and degrades to on when the database cannot be reached.
 *
 * The guide is a placeholder head, not a likeness, so failing open here cannot
 * misrepresent anybody. A likeness would want the opposite.
 */
export async function guideEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: GUIDE_SETTING_KEY } })
    return guideEnabledFromSetting(row?.value)
  } catch {
    return true
  }
}