import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HouseCapacityRequestStatus, type HouseCapacityRequest } from '@fonte/api-client';

import { CapacityRequestRow } from './CapacityRequestRow';

function makeReq(overrides: Partial<HouseCapacityRequest> = {}): HouseCapacityRequest {
  return {
    id: 'q1',
    status: HouseCapacityRequestStatus.PENDING,
    requestedGeneralCapacity: 12,
    requestedStaffCapacity: 3,
    previousGeneralCapacity: 10,
    previousStaffCapacity: 2,
    requestedBy: { name: 'Coord Ana' },
    createdAt: '2026-01-15T12:00:00.000Z',
    ...overrides,
  } as HouseCapacityRequest;
}

afterEach(() => cleanup());

describe('CapacityRequestRow', () => {
  it('mostra leitos solicitados, anteriores, solicitante e badge Pendente', () => {
    render(<CapacityRequestRow request={makeReq()} />);
    expect(screen.getByText(/12 leitos \(filhos\)/)).toBeInTheDocument();
    expect(screen.getByText(/3 leitos \(servos\)/)).toBeInTheDocument();
    expect(screen.getByText(/Anterior: 10 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText('Coord Ana')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('badge Aprovado para status APPROVED', () => {
    render(<CapacityRequestRow request={makeReq({ status: HouseCapacityRequestStatus.APPROVED })} />);
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('badge Rejeitado para status REJECTED', () => {
    render(<CapacityRequestRow request={makeReq({ status: HouseCapacityRequestStatus.REJECTED })} />);
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
  });

  it('usa fallbacks quando anterior e solicitante ausentes', () => {
    render(
      <CapacityRequestRow
        request={makeReq({
          previousGeneralCapacity: null,
          previousStaffCapacity: null,
          requestedBy: undefined,
        })}
      />,
    );
    expect(screen.getByText(/Anterior: — \/ —/)).toBeInTheDocument();
    expect(screen.getByText('Coordenador')).toBeInTheDocument();
  });
});
