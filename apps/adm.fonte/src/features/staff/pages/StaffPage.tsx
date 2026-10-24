import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Role } from "@fonte/types";
import type { Staff } from "@fonte/api-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { useStaff } from "../hooks/useStaff";
import { useStaffFiltersUrl } from "../hooks/useStaffFiltersUrl";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { DeleteStaffDialog } from "../components/DeleteStaffDialog";
import { StaffCard } from "../components/StaffCard";
import { StaffFilters } from "../components/StaffFilters";

export function StaffPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === Role.ADMIN;
  // Story 217/223 — busca, Ativos | Desligados e casa na URL (+ preferência).
  const filters = useStaffFiltersUrl({ canFilterHouse: isAdmin });
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [resetTarget, setResetTarget] = useState<Staff | null>(null);

  const {
    data: staff = [],
    isLoading,
    isError,
    refetch,
  } = useStaff({
    status: filters.status,
    search: filters.debouncedSearch,
    houseId: filters.houseId,
  });

  const emptyTitle = filters.isFiltering
    ? "Nenhum servo encontrado."
    : filters.status === "dismissed"
      ? "Nenhum servo desligado."
      : "Nenhum servo cadastrado.";

  return (
    <div>
      <PageHeader
        title={isLoading || isError ? "Servos" : `Servos (${staff.length})`}
        actions={
          <Button asChild>
            <Link to="/staff/new">
              <Plus size={16} className="mr-2" />
              Novo Servo
            </Link>
          </Button>
        }
      />

      <StaffFilters
        search={filters.search}
        onSearchChange={filters.setSearch}
        status={filters.status}
        onStatusChange={filters.setStatus}
        houseId={filters.houseId}
        onHouseIdChange={filters.setHouseId}
        showHouseFilter={isAdmin}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : staff.length === 0 ? (
        <EmptyState title={emptyTitle} />
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
