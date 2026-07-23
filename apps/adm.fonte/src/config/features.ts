/**
 * Feature flags do adm.fonte.
 *
 * Ponto único para ligar/desligar features cujo backend/infra já existe mas
 * ainda não deve aparecer para os operadores. Reativar é flipar o valor aqui.
 */

/**
 * App do interno (`resident.fonte`) em produção.
 *
 * Enquanto `false`, a seção "Acesso Digital" do filho (gerar acesso / resetar
 * senha do RESIDENT) fica oculta na ficha — o kiosk dedicado nem foi
 * scaffoldado e o botão só confunde. O login/sessão do RESIDENT no backend
 * segue existindo; isto é só UI. Não afeta o acesso de familiar (RELATIVE).
 */
export const RESIDENT_APP_ENABLED = false;
