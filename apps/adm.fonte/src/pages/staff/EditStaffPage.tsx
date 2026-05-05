import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGoBack } from "@/lib/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Role } from "@fonte/types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskPhone, withMask } from "../residents/masks";

interface House {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
  phone: string | null;
  houseId: string;
  user: { email: string; role: Role };
}

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum([Role.ADMIN, Role.COORDINATOR, Role.OPERATOR]),
  houseId: z.string().min(1, "Casa é obrigatória"),
  phone: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function EditStaffPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack("/staff");
  const queryClient = useQueryClient();

  const { data: houses = [] } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: () => api.get<House[]>("/houses").then((r) => r.data),
  });

  const { data: staff, isLoading } = useQuery<Staff>({
    queryKey: ["staff", id],
    queryFn: () => api.get<Staff>(`/staff/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (staff) {
      reset({
        name: staff.name,
        email: staff.user.email,
        role: staff.user.role as FormData["role"],
        houseId: staff.houseId,
        phone: staff.phone ?? "",
      });
    }
  }, [staff, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/staff/${id}`, {
        name: data.name,
        email: data.email,
        role: data.role,
        houseId: data.houseId,
        phone: data.phone || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      goBack();
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Editar Servo</h1>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {(mutation.error as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? "Erro ao salvar alterações."}
        </p>
      )}

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Função *</Label>
          <select id="role" {...register("role")} className={SELECT_CLASS}>
            <option value={Role.ADMIN}>Administrador</option>
            <option value={Role.COORDINATOR}>Coordenador</option>
            <option value={Role.OPERATOR}>Operador</option>
          </select>
          {errors.role && (
            <p className="text-sm text-destructive">{errors.role.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="houseId">Casa *</Label>
          <select
            id="houseId"
            {...register("houseId")}
            className={SELECT_CLASS}
          >
            <option value="">Selecione...</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {errors.houseId && (
            <p className="text-sm text-destructive">{errors.houseId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            {...withMask(register("phone"), maskPhone)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
