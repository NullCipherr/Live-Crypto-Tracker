import type { CoinMarket } from '../../types/crypto';
import { CoinRow } from './CoinRow';

interface CoinTableProps {
  coins: CoinMarket[];
  watchlistSet: Set<string>;
  onToggleFavorite: (coinId: string) => void;
}

export function CoinTable({ coins, watchlistSet, onToggleFavorite }: CoinTableProps) {
  return (
    <div className="space-y-4">
      {coins.map((coin) => (
        <CoinRow
          key={coin.id}
          coin={coin}
          favorite={watchlistSet.has(coin.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
