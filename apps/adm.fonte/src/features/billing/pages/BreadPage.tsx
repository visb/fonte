import { PageHeader } from '@/components/shared/PageHeader';
import { StreetSaleType } from '@fonte/types';
import { StreetSalesPageContent } from '../components/StreetSalesPageContent';

export function BreadPage() {
  return (
    <div>
      <PageHeader title="Pão" description="Faturamento de vendas de pão" />
      <StreetSalesPageContent type={StreetSaleType.BREAD} />
    </div>
  );
}
