const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const INDICACOES_WEBHOOK_URL = process.env.INDICACOES_WEBHOOK_URL || "";

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function enviarJson(res, status, dados) {
  const body = JSON.stringify(dados);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error("Payload muito grande."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

function limparTexto(valor, limite = 500) {
  return String(valor || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function dataPlanilhaHoje() {
  const data = new Date();
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function trimestreAtual() {
  return `T${Math.floor(new Date().getMonth() / 3) + 1}`;
}

function montarLinhaIndicacao(dados) {
  return {
    "Trim": trimestreAtual(),
    "Data indicação": dataPlanilhaHoje(),
    "Aluno": limparTexto(dados.aluno, 160),
    "Curso": limparTexto(dados.curso, 120),
    "Local indicado": limparTexto(dados.local_indicado, 220),
    "Cidade": limparTexto(dados.cidade, 120),
    "Estado": limparTexto(dados.estado, 2).toUpperCase(),
    "E-mail": limparTexto(dados.email, 180),
    "Telefone/WhatsApp": limparTexto(dados.telefone_whatsapp, 80),
    "Responsável do local": limparTexto(dados.responsavel_local, 160),
    "Responsável p/ contato": "",
    "Prazo 1º contato": "",
    "Data 1º contato": "",
    "Prazo 2º contato": "",
    "Data 2º contato": "",
    "Prazo 3º contato": "",
    "Data 3º contato": "",
    "Convênio firmado": "NÃO",
    "Link p/ Download": "",
    "Observações": limparTexto(dados.observacoes, 900)
  };
}

function validarIndicacao(dados) {
  const ausentes = [];
  if (!limparTexto(dados.aluno)) ausentes.push("Nome do aluno");
  if (!limparTexto(dados.curso)) ausentes.push("Curso");
  if (!limparTexto(dados.local_indicado)) ausentes.push("Local indicado");
  if (!limparTexto(dados.cidade)) ausentes.push("Cidade");
  if (!limparTexto(dados.estado)) ausentes.push("Estado");
  if (!limparTexto(dados.email)) ausentes.push("E-mail do local");
  if (!limparTexto(dados.telefone_whatsapp)) ausentes.push("Telefone/WhatsApp do local");
  return ausentes;
}

function enviarWebhook(url, dados) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(dados);
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.request(parsed, {
      method: "POST",
      timeout: 12000,
      headers: {
        "accept": "application/json",
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
        "user-agent": "FormularioIndicacaoUniFatecie/1.0"
      }
    }, resp => {
      let resposta = "";
      resp.setEncoding("utf8");
      resp.on("data", chunk => { resposta += chunk; });
      resp.on("end", () => {
        if (resp.statusCode < 200 || resp.statusCode >= 300) {
          return reject(new Error(`Power Automate retornou HTTP ${resp.statusCode}: ${resposta || "sem detalhes"}`));
        }
        resolve(resposta);
      });
    });

    req.on("timeout", () => req.destroy(new Error("Tempo limite ao enviar para o Power Automate.")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function servirArquivo(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const caminhoUrl = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const caminhoArquivo = path.normalize(path.join(PUBLIC_DIR, caminhoUrl));

  if (!caminhoArquivo.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Acesso negado.");
  }

  fs.readFile(caminhoArquivo, (error, conteudo) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Arquivo não encontrado.");
    }

    res.writeHead(200, { "content-type": tipos[path.extname(caminhoArquivo).toLowerCase()] || "application/octet-stream" });
    res.end(conteudo);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/indicacoes") {
    try {
      const dados = await lerJson(req);
      const camposAusentes = validarIndicacao(dados);
      if (camposAusentes.length) {
        return enviarJson(res, 400, { erro: `Preencha os campos obrigatórios: ${camposAusentes.join(", ")}.` });
      }

      const linha = montarLinhaIndicacao(dados);
      const payload = {
        origem: "formulario-online-indicacoes",
        aba: "Indicações",
        recebido_em: new Date().toISOString(),
        linha
      };

      if (!INDICACOES_WEBHOOK_URL) {
        return enviarJson(res, 503, {
          erro: "Integração com a planilha ainda não configurada.",
          detalhe: "Configure a variável INDICACOES_WEBHOOK_URL com o webhook do Power Automate."
        });
      }

      await enviarWebhook(INDICACOES_WEBHOOK_URL, payload);
      return enviarJson(res, 200, { ok: true, mensagem: "Indicação enviada com sucesso. Obrigado pela contribuição." });
    } catch (error) {
      console.error("[Indicações] Falha ao registrar indicação:", error);
      return enviarJson(res, 500, { erro: "Não foi possível registrar a indicação agora. Tente novamente em instantes.", detalhe: error.message });
    }
  }

  if (req.method === "GET" || req.method === "HEAD") return servirArquivo(req, res);

  res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
  res.end("Método não permitido.");
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Formulário de indicações rodando em http://localhost:${PORT}`));
}

module.exports = { server, montarLinhaIndicacao, validarIndicacao };
