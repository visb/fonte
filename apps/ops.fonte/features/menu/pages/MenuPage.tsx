import { ScrollView, View } from 'react-native';
import { useMenuAccess } from '../hooks/useMenuAccess';
import { MENU_SECTIONS } from '../constants';
import { MenuProfileCard } from '../components/MenuProfileCard';
import { MenuSection } from '../components/MenuSection';
import { MenuRow } from '../components/MenuRow';
import { MenuLogoutRow } from '../components/MenuLogoutRow';

/**
 * Índice completo do app (story 176): tudo que o usuário pode abrir, incluindo
 * o que já está na tab bar. Navegação estática — não faz fetch, então abre sem
 * sinal como o resto do ops.fonte.
 */
export function MenuPage() {
  const { menuItems } = useMenuAccess();

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
      <MenuProfileCard />
      {MENU_SECTIONS.map((section) => {
        const items = menuItems.filter((item) => item.section === section.key);
        // "Conta" sempre aparece: é onde mora o "Sair". As outras seções somem
        // inteiras quando o perfil não tem nenhum item — nada de título órfão.
        const isAccountSection = section.key === 'conta';
        if (items.length === 0 && !isAccountSection) return null;

        return (
          <MenuSection key={section.key} label={section.label}>
            <View>
              {items.map((item) => (
                <MenuRow key={item.key} item={item} />
              ))}
              {isAccountSection && <MenuLogoutRow />}
            </View>
          </MenuSection>
        );
      })}
    </ScrollView>
  );
}
