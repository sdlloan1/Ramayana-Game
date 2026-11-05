type AdSlotProps = {
  label: string;
};

/**
 * NitroPay placement. The PRD allows banner inventory on the main menu and the
 * game-over screen only, never over real-time combat. This component marks the
 * exact reserved slot; the production build swaps it for the NitroPay SDK view.
 */
export default function AdSlot({ label }: AdSlotProps) {
  return (
    <div className="ad-slot" aria-label="Reserved advertisement placement">
      <div className="ad-slot__head">
        <span className="ad-slot__tag">NitroPay</span>
        <span className="ad-slot__hint">Non-combat placement</span>
      </div>
      <p className="ad-slot__label">{label}</p>
      <p className="ad-slot__copy">Reserved safe banner inventory — no overlay on active combat.</p>
    </div>
  );
}
