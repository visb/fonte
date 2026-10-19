export function InstallSteps() {
  return (
    <section className="card" aria-labelledby="install-title">
      <h2 id="install-title">Como instalar</h2>
      <ol className="steps">
        <li>Abra esta página no celular Android e toque em “Baixar APK do Ops”.</li>
        <li>
          Ao abrir o arquivo baixado, o Android pode pedir para permitir a instalação de apps
          desconhecidos: toque em <em>Configurações</em>, ative a permissão para o navegador e
          volte.
        </li>
        <li>Toque em “Instalar”. Se já tiver o app, ele é atualizado sem perder seus dados.</li>
        <li>Abra o OPS Fonte e entre com seu WhatsApp ou e-mail e senha de sempre.</li>
      </ol>
    </section>
  );
}
