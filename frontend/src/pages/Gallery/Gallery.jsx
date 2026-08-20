import { Helmet } from 'react-helmet-async';
import PageHead from '../../components/PageHead/PageHead';
import SupportNote from '../../components/SupportNote/SupportNote';
import CtaBand from '../../components/CtaBand/CtaBand';
import { useFetch } from '../../hooks/useFetch';
import styles from './Gallery.module.css';

export default function Gallery() {
  const { data: photos, loading } = useFetch('/api/gallery');

  return (
    <>
      <Helmet><title>SACHI — Gallery</title></Helmet>

      <PageHead eyebrow="Gallery" title="A glimpse into our work in the field.">
        <p className={styles.headText}>
          Community health sessions, outreach programmes, training workshops, and the people we're proud to serve across Uganda.
        </p>
      </PageHead>

      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.grid}>
            {loading && <div className={styles.photo}>[ loading… ]</div>}
            {photos?.map((p) => (
              <div className={styles.photo} key={p.id}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.caption} />
                ) : (
                  `[ ${p.caption} ]`
                )}
              </div>
            ))}
          </div>
          <SupportNote text="Each of these moments was made possible by donor support. Help us create more of them." />
        </div>
      </section>

      <CtaBand
        title="Be part of the change in your community"
        text="Every photo tells a story of lives impacted. Partner with us and let's create more stories worth telling."
        ctaLabel="Get involved"
      />
    </>
  );
}
