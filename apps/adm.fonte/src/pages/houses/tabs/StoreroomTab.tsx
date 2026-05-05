import { Package } from "lucide-react";

export function StoreroomTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Package size={40} className="text-muted-foreground" />
      <p className="font-medium text-muted-foreground">Dispensa</p>
      <p className="text-sm text-muted-foreground">
        Esta funcionalidade será implementada em breve.
      </p>
    </div>
  );
}
