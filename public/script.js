function el(id){ return document.getElementById(id); }

function apiUrl(caminho){
  return window.location.protocol === "file:" ? `http://localhost:3000${caminho}` : caminho;
}

function setMensagem(tipo, texto){
  const msg = el("indicacaoMsg");
  if (!msg) return;
  msg.className = `form-feedback ${tipo ? `is-${tipo}` : ""}`.trim();
  msg.textContent = texto || "";
}

function atualizarOutroCurso(){
  const curso = el("curso");
  const box = el("outroCursoBox");
  const input = el("outro_curso");
  if (!curso || !box || !input) return;
  const mostrar = curso.value === "Outro";
  box.classList.toggle("hidden", !mostrar);
  input.required = mostrar;
  if (!mostrar) input.value = "";
}

function dadosFormulario(){
  const curso = el("curso").value === "Outro" ? el("outro_curso").value : el("curso").value;
  return {
    aluno: el("aluno").value,
    curso,
    local_indicado: el("local_indicado").value,
    cidade: el("cidade").value,
    estado: el("estado").value,
    email: el("email").value,
    telefone_whatsapp: el("telefone_whatsapp").value,
    responsavel_local: el("responsavel_local").value,
    observacoes: el("observacoes").value
  };
}


el("curso")?.addEventListener("change", atualizarOutroCurso);
document.addEventListener("DOMContentLoaded", atualizarOutroCurso);

el("indicacaoForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  form.classList.add("was-validated");
  setMensagem("", "");

  if (!form.checkValidity()) {
    setMensagem("error", "Revise os campos obrigatórios antes de enviar.");
    return;
  }


  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.disabled = true;
  setMensagem("info", "Enviando indicação...");

  try {
    const resp = await fetch(apiUrl("/api/indicacoes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosFormulario())
    });
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) throw new Error(json.erro || "Não foi possível enviar a indicação.");

    form.reset();
    form.classList.remove("was-validated");
    atualizarOutroCurso();
    setMensagem("success", json.mensagem || "Indicação enviada com sucesso.");
  } catch (error) {
    setMensagem("error", error.message || "Não foi possível enviar a indicação. Tente novamente em instantes.");
  } finally {
    if (submit) submit.disabled = false;
  }
});
