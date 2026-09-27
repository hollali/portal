'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { localToMediaUrl } from '@/lib/media'
import { jsonFetch } from '@/lib/jsonFetch'
import { Copy } from 'lucide-react'
import { PageHeader, Badge, Button } from '@/components/ui/kit'

export default function DuplicatesPage() {
  const router = useRouter()

  interface DuplicateImage {
    id: number
    url: string | null
    localPath: string | null
    source: string | null
    collectedAt: string | null
  }
  interface DuplicatesData {
    totalGroups: number
    totalDuplicates: number
    groups: DuplicateImage[][]
    page?: number
    perPage?: number
  }

  const PER_PAGE = 20

  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<'hash' | 'url'>('hash')
  const [errored, setErrored] = useState<Set<number>>(new Set())

  // `loading` is derived from whether the stored result matches the current
  // query key, rather than being set inside the effect. Setting it there caused
  // a cascading render on every filter change.
  const key = `${page}|${mode}`
  const [result, setResult] = useState<{ key: string; data: DuplicatesData | null } | null>(null)

  // This page had no role gate: the API 403s for non-admins, but the page
  // still rendered, so an editor landing here saw an empty shell.
  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin' && d?.role !== 'editor') {
        router.push('/admin')
      }
    })
  }, [router])

  useEffect(() => {
    let ignore = false
    jsonFetch<DuplicatesData>(`/api/admin/duplicates?page=${page}&mode=${mode}`).then(d => {
      if (!ignore) setResult({ key, data: d })
    })
    return () => { ignore = true }
  }, [key, page, mode])

  const stale = result?.key !== key
  const data = stale ? null : result?.data
  const loading = stale
  const loadError = !stale && result?.data == null

  const markErrored = useCallback((id: number) => {
    setErrored(prev => new Set(prev).add(id))
  }, [])

  const totalPages = data ? Math.max(1, Math.ceil(data.totalGroups / PER_PAGE)) : 1

  return (
    <div>
      <PageHeader
        title="Duplicate Images"
        icon={<Copy size={22} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Duplicates' }]}
        description={
          data
            ? `${data.totalGroups} group${data.totalGroups !== 1 ? 's' : ''} with ${data.totalDuplicates} duplicate${data.totalDuplicates !== 1 ? 's' : ''}`
            : 'Finding identical and re-hosted copies of the same image.'
        }
        actions={
          <div className="flex items-center gap-1" role="group" aria-label="Detection method">
            <Button
              size="sm"
              variant={mode === 'hash' ? 'secondary' : 'ghost'}
              onClick={() => { setMode('hash'); setPage(1) }}
              aria-pressed={mode === 'hash'}
            >
              Perceptual hash
            </Button>
            <Button
              size="sm"
              variant={mode === 'url' ? 'secondary' : 'ghost'}
              onClick={() => { setMode('url'); setPage(1) }}
              aria-pressed={mode === 'url'}
            >
              Shared URL
            </Button>
          </div>
        }
      />

      {loadError && (
        <div role="alert" className="card" style={{ padding: '1rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Could not load duplicates.
        </div>
      )}

      {loading && !data && <div style={{ color: 'var(--muted)' }}>Loading duplicates…</div>}

      {data && data.groups.length === 0 && !loadError && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No duplicates found</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            {mode === 'hash'
              ? 'No two images share a perceptual hash.'
              : 'No two records share the same source URL.'}
          </p>
        </div>
      )}

      {data?.groups.map((group: DuplicateImage[], i: number) => (
        <div key={i} className="card" style={{ marginBottom: '1rem' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Group {(page - 1) * PER_PAGE + i + 1}
            </span>
            <Badge tone="info">{group.length} items</Badge>
          </div>
          <div className="table-wrap table-cards">
            <table>
              <caption className="sr-only">
                Images in duplicate group {(page - 1) * PER_PAGE + i + 1}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Preview</th>
                  <th scope="col">ID</th>
                  <th scope="col">Source</th>
                  <th scope="col">URL</th>
                  <th scope="col">Collected</th>
                </tr>
              </thead>
              <tbody>
                {group.map((img: DuplicateImage) => {
                  const src = (!errored.has(img.id) && localToMediaUrl(img.localPath)) || img.url
                  return (
                    <tr key={img.id}>
                      <td data-label="Preview">
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '0.25rem', display: 'block' }}
                            onError={() => markErrored(img.id)}
                          />
                        ) : (
                          <div
                            style={{
                              width: '60px', height: '40px', background: 'var(--surface)',
                              borderRadius: '0.25rem', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: 'var(--muted)', fontSize: '0.65rem',
                            }}
                          >
                            No img
                          </div>
                        )}
                      </td>
                      <td data-label="ID"><Link href={`/images/${img.id}`} style={{ fontWeight: 600 }}>{img.id}</Link></td>
                      <td data-label="Source">{img.source ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td data-label="URL" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.url ? (
                          <a href={img.url} target="_blank" rel="noopener noreferrer">{img.url}</a>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>No URL</span>
                        )}
                      </td>
                      <td data-label="Collected" style={{ fontSize: '0.8rem' }}>
                        {img.collectedAt?.slice(0, 10) ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {data && data.totalGroups > PER_PAGE && (
        <nav className="pagination" aria-label="Duplicates pages" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <Button size="sm" variant="secondary" disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="current" aria-current="page">Page {page} of {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}
