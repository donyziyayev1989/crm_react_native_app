import { RefObject, useCallback, useRef } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

/**
 * Ro'yxatda bir vaqtda faqat bitta swipeable qator ochiq tursin.
 *   const { closeRow, registerRow } = useSwipeableRows();
 *   <ReanimatedSwipeable ref={registerRow(item.id)} onSwipeableWillOpen={() => closeRow(item.id)} />
 */
export function useSwipeableRows() {
  const rowRefs = useRef(new Map<string, SwipeableMethods>());
  const prevOpenedRow = useRef<string | null>(null);

  const closeRow = useCallback((id: string) => {
    if (prevOpenedRow.current !== null && prevOpenedRow.current !== id) {
      rowRefs.current.get(prevOpenedRow.current)?.close();
    }
    prevOpenedRow.current = id;
  }, []);

  // ReanimatedSwipeable `ref` propini RefObject deb e'lon qiladi, lekin uni oddiy
  // forwardRef orqali uzatadi, shuning uchun callback ref runtime'da ishlaydi.
  const registerRow = useCallback(
    (id: string) =>
      ((ref: SwipeableMethods | null) => {
        if (ref) rowRefs.current.set(id, ref);
        else rowRefs.current.delete(id);
      }) as unknown as RefObject<SwipeableMethods | null>,
    [],
  );

  return { closeRow, registerRow };
}
