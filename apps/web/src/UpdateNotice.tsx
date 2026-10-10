/** A button offering a reload when the host serves a newer build than this tab runs; the saved game is kept. */
export function UpdateNotice() {
  return (
    <button type="button" className="update-notice primary" data-testid="update-notice" onClick={() => location.reload()}>
      A new version is ready. Reload
    </button>
  );
}
