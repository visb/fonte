export function BreakingNotice() {
  return (
    <div className="notice warning" role="note" data-testid="breaking-notice">
      <strong>Esta versão exige desinstalar a anterior (uma única vez).</strong>
      <p>
        Antes de desinstalar, abra o app com internet e confira em <em>Pendências</em> que não há
        nada esperando sincronização — desinstalar apaga o que ainda não foi enviado. Depois
        desinstale o OPS Fonte e instale esta versão normalmente.
      </p>
    </div>
  );
}
