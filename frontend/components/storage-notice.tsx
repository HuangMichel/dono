import { Button } from "./ui";
import styles from "./storage-notice.module.css";

export function StorageNotice({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  if (!error) return null;
  return (
    <aside className={styles.notice} aria-label="Browser storage warning">
      <p role="alert">{error}</p>
      <Button variant="outline" onClick={retry}>
        Retry saving
      </Button>
    </aside>
  );
}
