import { QuoteCard, type DisplayQuote } from "./QuoteCard";

export interface QuoteAuctionGridProps {
  quotes: readonly DisplayQuote[];
  selectedQuoteId?: string;
  busyQuoteId?: string;
  disabled?: boolean;
  onSelect?: (quote: DisplayQuote) => void | Promise<void>;
}

export function QuoteAuctionGrid({ quotes, selectedQuoteId, busyQuoteId, disabled, onSelect }: QuoteAuctionGridProps) {
  if (quotes.length === 0) {
    return (
      <div className="quote-auction-empty">
        <span className="quote-auction-empty__scanner" aria-hidden="true" />
        <strong>UNDERWRITER NODES CALIBRATING</strong>
        <p>Waiting for signed capital offers.</p>
      </div>
    );
  }

  return (
    <div className="quote-auction-grid">
      {quotes.map((quote, index) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          rank={index + 1}
          selected={quote.id === selectedQuoteId}
          busy={quote.id === busyQuoteId}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
