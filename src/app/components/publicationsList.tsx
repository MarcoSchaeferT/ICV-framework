'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Calendar, Users } from 'lucide-react'
import type { PublicationI } from '../../../messages/publicationsContent'
import PUBLICATIONS_LIST from '../../../messages/publicationsContent'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from 'next-intl'


export function PublicationsList() {
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')
  const [filterType, setFilterType] = useState<PublicationI['type'] | 'all'>('all')

  const t = useTranslations('page_publications');

  const filteredPublications = PUBLICATIONS_LIST.filter(
    (pub) => filterType === 'all' || pub.type === filterType
  ).sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
    return a.title.localeCompare(b.title)
  })

  const typeColors: Record<PublicationI['type'], string> = {
    conference: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    journal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    preprint: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    workshop: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }

  return (
    <div className="space-y-6">
      {/* Filter and Sort Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterType('all')}
            className="rounded-full"
          >
            All
          </Button>
          {(['conference', 'journal', 'preprint', 'workshop'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              onClick={() => setFilterType(type)}
              className="rounded-full capitalize"
            >
              {type}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('sort_dropdown')}:</span>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as 'date' | 'title')}
        >
          <SelectTrigger className="w-full rounded-full border border-transparent bg-white px-3 py-2 text-sm text-black hover:bg-primary/90">
            <SelectValue placeholder="Sort options" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="date">{t('sort_options.latest_first')}</SelectItem>
              <SelectItem value="title">{t('sort_options.alphabetical')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Publications Grid */}
      <div className="grid gap-4 md:gap-6">
        {filteredPublications.map((publication) => (
          <Card key={publication.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl leading-tight mb-2">{publication.title}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {publication.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {publication.authors.length} author{publication.authors.length !== 1 ? 's' : ''}
                    </span>
                  </CardDescription>
                </div>
                <Badge className={typeColors[publication.type]}>
                  {publication.type}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Publication Details */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Authors</p>
                  <p className="text-sm text-muted-foreground">{publication.authors.join(', ')}</p>
                </div>

                {publication.conference && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Conference</p>
                    <p className="text-sm text-muted-foreground">{publication.conference}</p>
                  </div>
                )}

                {publication.journal && (
                  <div>
                    <p className="text-sm font-medium text-foreground">Journal</p>
                    <p className="text-sm text-muted-foreground">{publication.journal}</p>
                  </div>
                )}
              </div>

              {/* Abstract */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Abstract</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{publication.abstract}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {publication.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-2 pt-2">
                {publication.doi && (
                  <a
                    href={`https://doi.org/${publication.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    DOI: {publication.doi}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {publication.url && (
                  <a
                    href={publication.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Read Paper
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredPublications.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">{t('no_publications_found')}</p>
          </CardContent>
        </Card>
      )}

      {/* Publication Count */}
      <p className="text-sm text-muted-foreground text-center mt-8">
         {t('PublicationCount.showing')} {filteredPublications.length} {t('PublicationCount.of')} {PUBLICATIONS_LIST.length} {t('PublicationCount.publications')}
      </p>
    </div>
  )
}