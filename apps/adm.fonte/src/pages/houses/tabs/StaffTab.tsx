import { useQuery } from "@tanstack/react-query";
import { Pencil, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

interface StaffItem {
  id: string;
  name: string;
  phone: string | null;
}

export function StaffTab({ houseId }: { houseId: string }) {
  const navigate = useNavigate();
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
          <div className="flex items-center gap-3">
            {s.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone size={12} />
                {s.phone}
              </span>
            )}
            <button
              onClick={() => navigate(`/staff/${s.id}/edit`)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Editar servo"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
