import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useHouses } from '@/features/houses/hooks/useHouses';

interface HouseFilterSelectProps {
  /** Id da casa selecionada; `''` = "Todas as casas". */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Seletor de casa dos filtros de listagem (filhos — stories 129/130; servos —
 * story 223). Busca as próprias casas; a opção vazia é "Todas as casas".
 */
export function HouseFilterSelect({ value, onChange, className }: HouseFilterSelectProps) {
  const { data: houses = [] } = useHouses();

  return (
    <Select
      aria-label="Casa"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('w-full sm:w-48', className)}
    >
      <option value="">Todas as casas</option>
      {houses.map((house) => (
        <option key={house.id} value={house.id}>
          {house.name}
        </option>
      ))}
    </Select>
  );
}
