import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { api } from "@/lib/api";

interface StaffItem {
  id: string;
  name: string;
  phone: string | null;
}

export function StaffTab({ houseId }: { houseId: string }) {
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["houses", houseId, "staff"],
    queryFn: () =>
      api.get<StaffItem[]>(`/houses/${houseId}/staff`).then((r) => r.data),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  if (staff.length === 0)
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        Nenhum servo cadastrado nesta casa.
      </p>
    );

  return (
    <div className="space-y-1">
      {staff.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <p className="font-medium text-sm">{s.name}</p>
          {s.phone && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Phone size={12} />
              {s.phone}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
