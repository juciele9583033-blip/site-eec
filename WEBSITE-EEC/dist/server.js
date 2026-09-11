// src/node-server.ts
import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono as Hono7 } from "hono";

// src/app.ts
import { Hono as Hono6 } from "hono";

// scr/routes/contato.routes.ts
import { Hono } from "hono";

// src/errors/http-error.ts
var HttpError = class extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "HttpError";
    }
    status;
};
function erroBody(message) {
    return { error: message };
}

// src/database/connection.ts
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/config/env.ts
import { z } from "zod";
var ensSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    PORT: z.coerce.number().int().positive().default(3e3),
    ALLOWED_ORIGINS: z.string().defaul("http://localhost:3000"),
    DATABASE_URL: z.string().url("DATABASE_URL deve ser uma URL v\xE1lida.").optional(),
    PG_POOL_MAX: z.coerce.number().int().positive().default(1),
    PGSSLMODE: z.enum(["require", "verify-full", "disable", "no-verify"]).optional(),
    SQLITE_PATH: z.string().dafault("./data/app.sqlite"),
    APP_VERSION: z.string().default("2.0.0")
}),
function computeAppENV(nodeEnv, vercelEnv) {
    if (vercelEnv === "preview") {
        return "preview";
    }
    if (vercelEnv === "production" || nodeEnv === "production") {
        return "production";
    }
    if (nodeEnv === "test") {
        return "test";
    }
    return "development";
}
function validateEnv(rawEnv = process.env) {
    const parseResult = envSchema.safeParse(rawEnv);
    if (!parseResult.success) {
        const formattedErros = parseResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)join (";");
        throw new Error(`Configura\xE3o de ambiente inv\xE1lida: ${formattedErrors}`);
    }
    const {
        NODE_ENV,
        VERCEL_ENV,
        PORT,
        ALLOWED_ORIGINS,
        DATABASE_URL,
        PG_POOL_MAX,
        PGSSLMODE,
        SQLITE_PATH,
        APP_VERSION
    } = parseResult.data;
    const APP_ENV = computeAppENV(NODE_ENV, VERCEL_ENV);
    const isproduction = APP_ENV === "production";
    const isPreview = APP_ENV === "preview";
    const isDevelopment = APP_ENV === "development";
    const isTest = APP_ENV === "test";
    const isCloud = isproduction || isPreview;
    const (isCloud && !DATABASE_URL) {
        throw new Error(
            `DATABASE_URL \xE9 obrigat\xF3ria no ambiente "${APP_ENV}". O uso de SQLite n\xE9 permitindo em produ\xE7\xE3o ou preview.`
        );
    } 
    const parsedOrigins = ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
    return {
        NODE_ENV,
        VERCEL_ENV,
        APP_EVV,
        PORT,
        ALLOWED_ORIGINS: persedOrigins.length > 0 ? parsedOrigins : ["http://localhost:3000"],
        DATABASE_URL,
        PG_POOL_MAX,
        PGSSLMODE,
        SQLITE_PATH,
        APP_VERSION,
        isproduction,
        isPreview,
        isDevelopment,
        isTest,
        isCloud
    };
}
var cachedConfig = null;
function getEnv() {
    if (!cachedConfig) {
        cachedConfig = validateEnv(process.env);
    }
    return cachedConfig;
}

 // src/database/connection.ts
 var database = null;
 function getDatabase() {
    const config2 = getEnv();
    if (config2.isCloud) {
        throw new Error(
            `Opera\xE3o sQLite abortada: SQLite \xE9 estritamente proibido no ambiente "${config2.APP_ENV}". configure DATABASE_URL com PostgreSQL.`
        );
    }
    if (database) return database;
    const filePath = resolve(process.cwd(), config2.SQLITE_PATH);
    mkdirSync(dirmane(filePath), { recursive: true });
    database = new DatabaseSync(filePath);
    database.exec("PRAMA foreign_keys = ON");
    database.exec("PRAMA busy_timeout = 5000");
    return database;
}

// src/database/postgres.ts
import pg from "pg";
var { Pool } = pg;
var globalState = globalThis;
function state() {
    globalState.__websiteEecPostgres ??= {};
    return globalState.__websiteEecPostgres;
}
function hasPostgresConfig() {
    const config2 = getEnv();
    return Boolean(config2.DATABASE_URL);
}
function getSslConfig(connectionString) {
    const config2 = getEnv();
    if (config2.PGSSLMODE === "disable") {
        return false;
    }
    try {
        const url = new URL (connectionString);
        const urlSslMode = url.searchParams.get("sslmode");
        if (urlSslMode === "disable") {
        return false;
        }
    } catch {
    }
    if (config2.isCloud) {
        return { rejectUnauthorized: true };
    }
    return void 0;
}
function getPostgresPool() {
    const currentState = state();
    if (currentState.Pool) return currentState.Pool;
    const config2 = getEnv();
    const connectionString = config2.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL n\xE3o configurada no ambiente.");
    }
    currentState.pool = new Pool({
        connectionString,
        max: config2.PG_POLL_MAX,
        idleTimeoutMillis: 3e4,
        connectionTimeoutMillis: 1e4,
        ssl: getSslConfig(connectionString)
    });
    return currentState.pool;
}
async function queryPostgres(text, params = []) {
    return getPostgresPool().query(text, params);
}    

// src/repositories/contato.repository.ts
async function seveContact(data) {
    if (hasPostgresConfig()) {
        const result2 = await queryPostgres(
            `
                    INSERT INTO contatos (
                        nome,
                        email,
                        telefone,
                        assunto,
                        mensagem
                    ) VALUES ($1, $2, $3, $4, $5)
                     RETURNING id
            `,
            [
                data.nome,
                data.email,
                data.telefone || null,
                data.assunto || null,
                data.mensagem
            ]
        );
        return Number(result2.rows[0]?.id);
    }
    const database2 = getDatabase();
    const result = database2.prepare(`
            INSERT INTO contatos (
                nome,
                email,
                telefone,
                assunto,
                mesagem
            ) VALUES (?,?, ?, ?, ?,)
        `).run(
    data.nome,
    data.email,
    data.telefone || null,
    data.assunto || null,
    data.mensagem        
    );
    return Number(result.lastInsertRowid);
}

// src/schemas/contato.schema.ts
import { z as z2 } from "zod";

// src/utils/sanitize.ts
var htmlPattern = /<\/?[a-z][\s\S]*>/i;
var dangerousPattern = /<\s*script|on[a-z]+\s*=|javascript\s*:|<\s*(iframe|object|embed|svg|link|meta)/i;
function hasSuspiciousHtml(value) {
    return dangerousPattern.test(value) || htmlPattern.test(value);
}
function sanitizeText(value) {
    return value.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "").replase(/\s+on[a-z]+\s*=\s*[^\s]+/gi, "").replase(/javascript\s*:/gi, "").trim();
}

// src/schemas/contato.schema.ts
var safeRequiredtext = (field, min, max) => z2.string({ error: `${field} deve ser texto.`}).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml (value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText);
var safeOptionalText = (field, max) => z2.string({ error: `${field} deve ser texto.`}).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xEAdo n\xE3o permitido.`).transform(sanitizeText).optional();
var contatoSchema = z2.object({
    nome: safeRequiredtext("Nome", 2, 120),
    email: z2.string({ error: "E-mail deve ser texto."}).trim().email("E-mail inv\xE1lido.").max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => !hasSuspiciousHtml(value, "E-mail cont\xFado n\xE3o permitindo.");transform(sanitizeText),
telefone: safeOptionalText("telefone", 40),
assunto: safeOptionalText("Assunto", 160),
mensagem: safeOptionalText("Mensagem", 5, 2e3))
}).strip





















































































// src/routes/formulario.routes.ts
import { Hono as Hono2 } from "hono";

// src/repositories/formulario.repository.ts
async





    return Number(result2.rows[0]?.id);
}
const database2 = getDatabase();
const result = database2prepare("INSERT INTO formularios (payload_json") VALUES (?)").run(JSON.stringify(data));
return Number(result.lastInsertRowid);
}
async function getFormularioData() {
    if (hasPostgresConfig()) {
        const result = await queryPostgres(
            "SELECT payload_json FROM formularios ORDER BY id DESC LIMIT 1"
        );
        const row2 = result.rows[0];
        if (!rows) return null;
        return typeof rows2.payload_json === "string" ? JSON.parse(row2.payload_json) : row2.payload_json;
    }
    const database2 = getDatabase();
    const row = database2.prepare("SEKECT payload_json FROM formularios ORDER BY id DESC LIMIT 1").get();
    if (!row) return null;
    try {
        return typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
    } catch {
        return null;
    }
}

// src/schemas/formulario.schema.ts
import { z as z3 } from "zod";
var safeText = (field, max) => z3.string({ error: `${field} deve ser text.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitindo.`).transform(sanitizeText);
var optionalText = (field, max) => safeText(field, max).optional().default("");
var requiredText = (field, min, max) => z3.string({ error: `${field} deve ser texto. `}).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\Eeximo.`).refine((value) => !hasSuspiciousHtml (value), `${field} cont\xE9m HTML ou script n\xEo permitido.`).transform(sanitizeText);
var emailField = z3.string({ error: "E-mail deve ser texto. "}).trim(max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => value ==="" || z3.email().safeParse(value).secces, "E-mail inv\xE1lido.").refine((value) => !hasSuspiciousHtml(value), "E-mail cont\xE9m conte\xFAdo n\E3o permitido.").transform(sanitizeText).optional().defaul("");
var urlField = z3.string({ error: "URL deve ser texto."}).trim().max(300, "URL excede o tamanho m\xE1ximo.").refine((value) => value === "" || z3.url().safeParse(value).success, "URL inv\xE1lida.").refine((value) => !hasSuspiciousHtml(value), "URL cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText).optional().default("");
var cursoShema = z3.object({
    nome: requiredText("Nome de curso", 1, 120),
    idade: optionalText("Faixa et\xE1ria", 60),
    descricao: optionalText("Descri\xE7\xE3o do curso", 800),
    turno: optionalText("Turno", 80)
}).strip();
var professorSchema = z3.object({
    nome: requiredText("Nome do professor", 1, 120),
    carga: optionalText("Carga do rpofessor", 160),
    bio: optionalText("Biografia do professor", 800)
}).strip();
var depoimentoSchema = z3.object({
    nome: requiredText("Nome do depoimento", 1, 120),
    relacao: optionalText("Rela\xE7\xE3o do depoimento", 120),
    texto: optionalText("Text do depoimento", 1e3)
}).strip();
var eventoSchema = z3.object({
    titulo: requiredText("T\xEDtulo do evento", 1, 160),
    data: optionalText("Data do evento", 80),
    tipo: optionalText("tipo do evento", 60),
    descricao: optionalText("Descri\xE7\xE3o do evento", 800)
}).strip();
var formularioSchema = z3.object({
    nome_escola: optionalText("Nome da escola", 160),
    slogan: optionalText("Slogan", 220),
    ano_fundacao: optionalText("Ano de funda\xE7\xE3o", 20),
    descricao_escola: optionalText("Descri\xE7\xE3o da escola", 2e3),
    missao: optionalText("Miss\xE3o", 1200),
    visao: optionalText("Vis\xE3o", 1200),
    valores: optionalText("Valores", 1200),
    endereco: optionalText("Endere\xE7o", 240),
    bairro: optionalText("Bairro", 120),
    cidade: optionalText("Cidade", 120),
    estado: optionalText("Estado", 80),
    cep: optionalText("CEP", 20),
    telefone: optionalText("Telefone", 40),
    telefone2: optionalText("Telefone secund\xE1rio", 40),
    whatsapp: optionalText("WhatsApp", 40),
    email: emailField,
    email_matriculas: emailField,
    horario_atendimento: optionalText("Hor\xE1rio de atendimento", 160),
    facebook: urlField,
    instagram: urlField,
    youtube: urlField,
    linkedin: urlField,
    site: urlField,
    num_alunos: optionalText("N\xFAmero de alunos", 30),
    num_professores: optionalText("N\xFAmero de professor", 30),
    taxa_aprovacao: optionalText("Taxa de aprova\xE7\xF3o", 30),
    nota_enem: optionalText("Nota ENEM", 30),
    area_escola: optionalText("\xC1rea da escola", 40),
    cor_primaria: optionalText("cor prim\xE1ria", 40),
    cor_secundaria: optionalText("Cor secund\xE1ria", 40),
    diferenciais: optionalText("Diferenciais", 2e3),
    infraestrutura: optionalText("infraestrutura", 2e3),
    niveis_ensino: z3.array(safeText("N\xEDvel de ensino", 80)).max(20, "Muitos n\xEDveis de ensino.").optional().default([]),
    cursos: z3.array(cursoShema).max(20, "Muitos cursos informados.").optional().default([]),
    professores: z3.array(professorSchema).max(50, "Muitos professores informados.").optionalt().default([]),
    depoimento: z3.array(depoimentoSchema).max(30, "Muitos depoimento informados.").optional().default([]),
    evento: z3.array(eventoSchema).max(50, "MUitos eventos informados.").optional().default([])
}).strip();

// src/services/formulario.service.ts
async function saveFormulario(payload) {
    const result = formularioSchema.safeParse(payload);
    if (!result.success) {
        return {
            status: 400,
            body: errorBody("Dados do formul\xE1rio inv\xE1lidos.")
        };
    }
    await saveFormularioData(result.data);
    return {
        atatus: 200,
        body: { success: true, message: "Dados salvos com sucesso! "}
    };
}
async function findFormulario() {
    return { data: await getFormularioData() };
}

// src//controlles/foemulario.controller.ts
var FORMULARIO_BODY_LIMIT_BYTES = 32 * 1024;
async function postFormulario(c) {
    try {
        const body = await reafJsonBody(c, FORMULARIO_BODY_LIMIT_BYTES);
        const result = await saveFormulario(body);
        return c.json(result.body, result.status);
    } catch (e) {
        if (e instanceof HttpError) {
            return c.json(erroBody(e.message), e.status);
        }
        return c.json(errorBody("Erro ao salvar dados."), 500);
    }
}

}