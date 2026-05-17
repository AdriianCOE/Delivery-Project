import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export function useCoupons(storeId) {
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'coupons'),
      where('storeId', '==', storeId),
      where('active', '==', true)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCoupons(list);
    });

    return () => unsub();
  }, [storeId]);

  return { coupons };
}

