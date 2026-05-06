import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Resident } from '@fonte/api-client';

const STATUS_LABEL: Record<string, string> = {
  PRE_ADMISSION: "Pré-admissão",
  ACTIVE: "Ativo",
  DISCIPLINE: "Disciplina",
  TEMP_LEAVE: "Afastamento",
  DISCHARGED: "Alta",
  EVADED: "Evasão",
};

type BadgeVariant = "success" | "destructive" | "warning" | "secondary" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  PRE_ADMISSION: "secondary",
  DISCIPLINE: "destructive",
  TEMP_LEAVE: "warning",
  DISCHARGED: "outline",
  EVADED: "destructive",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function ResidentsTab({ houseId }: { houseId: string }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ["houses", houseId, "residents"],
    queryFn: () => api.houses.listResidents(houseId),
  });

  const { data: detail } = useQuery({
    queryKey: ["residents", selectedId],
    queryFn: () => api.residents.getById(selectedId!),
    enabled: !!selectedId,
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  if (residents.length === 0)
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        Nenhum filho cadastrado nesta casa.
      </p>
    );

  return (
    <>
      <div className="space-y-1">
        {residents.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                Entrada: {formatDate(r.entryDate)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          </button>
        ))}
      </div>

      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Filho</DialogTitle>
          </DialogHeader>
          {!detail ? (
            <p className="text-muted-foreground text-sm py-4">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {detail.photoUrl ? (
                  <img
                    src={api.photoUrl(detail.photoUrl)!}
                    alt={detail.name}
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base">{detail.name}</p>
                  <Badge variant={STATUS_VARIANT[detail.status] ?? "outline"} className="mt-1">
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">Entrada</span>
                <span>{formatDate(detail.entryDate)}</span>

                <span className="text-muted-foreground">Idade</span>
                <span>
                  {calcAge(detail.birthDate) !== null
                    ? `${calcAge(detail.birthDate)} anos`
                    : "—"}
                </span>

                <span className="text-muted-foreground">CPF</span>
                <span>{detail.cpf || "—"}</span>

                <span className="text-muted-foreground">RG</span>
                <span>{detail.rg || "—"}</span>

                <span className="text-muted-foreground">Telefone</span>
                <span>{detail.contactPhone || "—"}</span>

                <span className="text-muted-foreground">Ocupação</span>
                <span>{detail.occupation || "—"}</span>

                {detail.addiction && (
                  <>
                    <span className="text-muted-foreground">Dependência</span>
                    <span>{detail.addiction}</span>
                  </>
                )}

                {detail.healthIssues && (
                  <>
                    <span className="text-muted-foreground">Saúde</span>
                    <span>{detail.healthIssues}</span>
                  </>
                )}

                {detail.continuousMedication && (
                  <>
                    <span className="text-muted-foreground">Medicação</span>
                    <span>{detail.continuousMedication}</span>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedId(null);
                    navigate(`/residents/${detail.id}`);
                  }}
                >
                  Ver página completa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
