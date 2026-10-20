import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import type { StaffListStatus } from "@fonte/types";
import type { Staff } from "@fonte/api-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useStaff } from "../hooks/useStaff";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { DeleteStaffDialog } from "../components/DeleteStaffDialog";
import { StaffCard } from "../components/StaffCard";
import { StaffStatusFilter } from "../components/StaffStatusFilter";

export function StaffPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Story 217 — filtro Ativos | Desligados na URL (volta do detalhe mantém o filtro).
  const status: StaffListStatus =
    searchParams.get("status") === "dismissed" ? "dismissed" : "active";
  const setStatus = (next: StaffListStatus) =>
    setSearchParams(next === "dismissed" ? { status: next } : {}, {
      replace: true,
    });
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [resetTarget, setResetTarget] = useState<Staff | null>(null);

  const {
    data: staff = [],
    isLoading,
    isError,
    refetch,
  } = useStaff({ status });

  return (
    <div>
      <PageHeader
        title="Servos"
        actions={
          <Button asChild>
            <Link to="/staff/new">
              <Plus size={16} className="mr-2" />
              Novo Servo
            </Link>
          </Button>
        }
      />

      <div className="mb-4">
        <StaffStatusFilter value={status} onChange={setStatus} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : staff.length === 0 ? (
        <EmptyState
          title={
            status === "dismissed"
              ? "Nenhum servo desligado."
              : "Nenhum servo cadastrado."
          }
        />
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              href={`/staff/${s.id}`}
              onEdit={() => navigate(`/staff/${s.id}/edit`)}
              onResetPassword={() => setResetTarget(s)}
              onDelete={() => setDeleteTarget(s)}
            />
          ))}
        </div>
      )}

      <ResetPasswordDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        staff={resetTarget}
      />
      <DeleteStaffDialog
        staff={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
