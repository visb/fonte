import { Matches } from 'class-validator';

/**
 * Formato da chave de preferência (decisão 2): letra minúscula inicial, depois
 * minúsculas/dígitos/ponto, até 64 chars. Validada por formato — sem whitelist
 * por tela, para que uma tela nova crie a própria chave sem mexer no backend.
 * Barra a travessia de path (`../../etc`) por não casar o padrão.
 */
export class PreferenceKeyParam {
  @Matches(/^[a-z][a-z0-9.]{0,63}$/, {
    message: 'key deve casar ^[a-z][a-z0-9.]{0,63}$',
  })
  key: string;
}
