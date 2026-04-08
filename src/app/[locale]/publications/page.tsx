import { useTranslations } from 'next-intl';
import { PublicationsList } from '../../components/publicationsList'
import { Link } from "@/i18n/routing";


export default function Home() {


  const t = useTranslations('page_publications');

  return (
    <main className="min-h-screen min-w-4xl max-w-7xl justify-center mx-auto">
      <div className="container mx-auto px-4 py-12">
        {/* Project Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">
            {t('descriptionPart1')} <Link className='text-accent' href="/about"> {t('descriptionPart2Title')}</Link> {t('descriptionPart3')}
          </p>
        </div>

        {/* Publications Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8">{t('publicationsTitle')}</h2>
          <PublicationsList />
        </section>
      </div>
    </main>
  )
}