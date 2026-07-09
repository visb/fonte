import { Link } from 'react-router-dom';
import { FileUp, Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ImportPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Importar" />

      <Card>
        <CardHeader>
          <CardTitle>Filhos</CardTitle>
          <CardDescription>
            Importar fichas de acolhimento (.docx) — uma ficha por vez ou várias de uma vez com a
            planilha de referência.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/residents/import">
              <FileUp size={16} className="mr-2" />
              Individual
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/residents/import-lote">
              <Files size={16} className="mr-2" />
              Em lote
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
