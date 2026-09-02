'use client'

import ListPage from '@/components/ListPage'

export default function NewsListPage() {
  return (
    <ListPage
      type="news"
      apiPath="/api/news"
      title="News"
      searchPlaceholder="Search news by title, URL, source, snippet..."
      detailPrefix="/news/"
      columns={[
        { key: 'id', label: 'ID', sortable: true },
        { key: 'title', label: 'Title', sortable: true },
        { key: 'sourceName', label: 'Source', sortable: true },
        { key: 'date', label: 'Date', sortable: true },
        { key: 'collectedAt', label: 'Collected', sortable: true },
      ]}
    />
  )
}
