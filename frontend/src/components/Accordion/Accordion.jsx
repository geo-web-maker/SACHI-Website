import { useState } from 'react';
import styles from './Accordion.module.css';

export default function Accordion({ items }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? null);

  return (
    <div className={styles.list}>
      {items.map((item) => {
        const isOpen = item.id === openId;
        return (
          <div className={styles.item} key={item.id}>
            <button
              className={styles.question}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>&darr;</span>
            </button>
            {isOpen && <p className={styles.answer}>{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
