import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityStatus } from '@fonte/types';

// Campo responsável tem teste próprio (ResponsibleField.test.tsx).
jest.mock('./ResponsibleField', () => {
  const { Text } = require('react-native');
  return { ResponsibleField: () => <Text>responsible-field</Text> };
});

import { NewActivityForm } from './NewActivityForm';

const ALL = [ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO];

describe('NewActivityForm (story 224)', () => {
  it('enviando: mostra o indicador no lugar do texto', () => {
    render(
      <NewActivityForm
        defaultStatus={ActivityStatus.DRAFT}
        statusOptions={ALL}
        isPending
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.queryByText('Criar rascunho')).toBeNull();
    expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
  });

  it('o texto do botão segue a coluna escolhida', () => {
    render(
      <NewActivityForm
        defaultStatus={ActivityStatus.DRAFT}
        statusOptions={ALL}
        isPending={false}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('Criar rascunho')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Criar em Solicitação'));
    expect(screen.getByText('Criar solicitação')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Criar em A fazer'));
    expect(screen.getByText('Criar atividade')).toBeTruthy();
  });
});
